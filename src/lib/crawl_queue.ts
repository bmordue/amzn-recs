import async from "async";
import { createProdAdvClient } from "./aws";
import { RateLimiter } from "limiter";
import metrics from "./metrics";
import util from "util";
import * as config from "./config";
import { DbConnector } from "./graphdb_connector";
import * as log from "./log";
import { fetch } from "./price_connector";
import { fakeProdAdv } from "./fake_prodadv";
import { Item } from "./Item";

const statsd = metrics;

type CrawledResponse = {
  crawled: boolean;
};

export type PriceLookupResponse = {
  price?: number;
  currency?: string;
};

// eslint-disable-next-line no-unused-vars
export type CallbackFn = (
  err?: Error,
  result?: Item[] | CrawledResponse | PriceLookupResponse
) => void;

export class CrawlQueue {
  static inputDir = "./temp/output";

  static doneDir = "./temp/done";

  static errorDir = "./temp/errors";

  private maxCrawlDepth: number;

  nodeCount: number;

  private doPriceLookup: boolean;

  prodAdv: Function;

  private limiter: RateLimiter;

  db: DbConnector;

  private BACKOFF_SECONDS = 10;

  constructor(options) {
    if (!options) {
      options = {};
    }
    this.maxCrawlDepth = options.maxCrawlDepth || 2;
    this.nodeCount = 0;
    log.debug({}, `maxCrawlDepth: ${this.maxCrawlDepth}`);

    this.doPriceLookup = options.doPriceLookup;
    if (!this.doPriceLookup) {
      log.info({}, "Price lookup is not enabled");
    }

    const keyId = config.get("AMZN_ACCESS_KEY_ID");
    const keySecret = config.get("AMZN_ACCESS_KEY_SECRET");
    const associateTag = config.get("AMZN_ASSOCIATE_TAG");
    const amazonServiceHost = config.get("AMZN_SERVICE_HOST");

    if (keyId && keySecret && associateTag) {
      this.prodAdv = createProdAdvClient(keyId, keySecret, associateTag, {
        host: amazonServiceHost,
      });
      log.info({}, "Created prodAdv client");
    } else {
      this.prodAdv = fakeProdAdv;
      log.info({}, "Using fakeProdAdv");
    }
    //  this.limiter = new RateLimiter(50, "minute");
    this.limiter = new RateLimiter(1, 3000); // 1 every N ms
    this.db = new DbConnector();
  }

  callProdAdv(query: string, params: object, callback) {
    statsd.increment("call_product_advertising_api");

    this.prodAdv.call(this, query, params, callback);
  }

  throttledSimilarityLookup(asin: string, callback: CallbackFn) {
    const self = this;
    log.debug({}, "throttledSimilarityLookup");
    this.limiter.removeTokens(1, function (err: Error) {
      log.debug({}, "called back from limited");
      if (err) {
        return callback(err, null);
      }
      this.callProdAdv(
        "SimilarityLookup",
        { ItemId: asin },
        (err: Error, data: Item[]) => {
          if (
            err &&
            err.message.indexOf("submitting requests too quickly") != -1
          ) {
            log.warn(
              { err },
              "Submitting requests too quickly; back off and retry"
            );
            setTimeout(
              () => self.throttledSimilarityLookup(asin, callback),
              self.BACKOFF_SECONDS
            );
          } else {
            return callback(err, data);
          }
        }
      );
    });
  }

  throttledPriceLookup(asin: string, callback: CallbackFn) {
    if (!this.doPriceLookup) {
      return callback(null, {});
    }
    this.limiter.removeTokens(1, (err) => {
      if (err) {
        return callback(err, null);
      }
      fetch(asin, callback);
    });
  }

  alreadyCrawled(asin: string, callback: CallbackFn) {
    const self = this;
    this.db.getBookNode(asin, (err, node) => {
      if (err) {
        return callback(err, null);
      }
      if (!node) {
        return callback(null, { crawled: false });
      }
      self.db.countOutgoingRecommendations(asin, (err, result) => {
        if (err) {
          return callback(err, null);
        }
        if (!result.outgoing) {
          return callback(null, { crawled: false });
        }
        callback(null, { crawled: true });
      });
    });
  }

  crawl(rootAsin: string, depth: number, callback: CallbackFn) {
    this.nodeCount++;
    log.debug({ current_depth: depth, parent_node: rootAsin }, "crawling");
    const self = this;
    depth += 1;
    if (depth > self.maxCrawlDepth) {
      log.debug({}, util.format("Reached depth %s, stop crawling", depth));
      return callback(null, null);
    }
    const nodesAdded = [];
    async.waterfall(
      [
        function (cb) {
          self.throttledSimilarityLookup(rootAsin, cb);
        },
        function (similar, cb) {
          if (!similar.Items || !similar.Items.Item) {
            log.info({ asin: rootAsin }, "Similar items list is empty");
            return cb();
          }
          log.debug(
            { asin: rootAsin, child_count: similar.Items.Item.length },
            "Start crawling children"
          );
          async.each(
            similar.Items.Item,
            (item, each_cb) => {
              async.waterfall(
                [
                  function (cb) {
                    nodesAdded.push(item);
                    self.addToGraph(rootAsin, item, cb);
                  },
                  function (cb) {
                    self.crawl(item.ASIN, depth, cb);
                  },
                ],
                (err) => {
                  log.debug({ asin: item.ASIN }, "Finished walking child node");
                  each_cb(err);
                }
              );
            },
            cb
          );
        },
      ],
      (err) => {
        log.debug({ asin: rootAsin }, "Finished crawling");
        callback(err, nodesAdded);
      }
    );
  }

  addToGraph(parent, item, callback: CallbackFn) {
    const self = this;
    self.ensureRequiredFields(parent, item, (err) => {
      if (err) {
        log.error(item, "Could not add required fields for graph node");
        return callback(err);
      }

      self.throttledPriceLookup(
        item.ASIN,
        (err: Error, result: PriceLookupResponse) => {
          if (err) {
            log.error(
              { error: err.message },
              `error looking up price for ASIN ${item.ASIN}`
            );
            // add to graph without price, so drop this error
          }
          if (result) {
            item.price = result.price;
            item.currency = result.currency;
          }
          self.db.createChildBookNodeAndRelations(
            parent,
            item,
            (err, result) => {
              log.debug({ result }, "Finished creating node and relations");
              // drop result to not cause problems at next step
              callback(err);
            }
          );
        }
      );
    });
  }

  ensureRequiredFields(parent, item, callback) {
    const self = this;
    if (!item.Title || !item.Author || !item.DetailPageUrl) {
      log.debug(item, "Missing required field; attempt to add it");
      this.limiter.removeTokens(1, (err) => {
        if (err) {
          return callback(err, null);
        }
        self.callProdAdv("ItemLookup", { ItemId: item.ASIN }, (err, result) => {
          if (err) {
            return callback(err, null);
          }
          return callback(null, result.Items.Item);
        });
      });
    } else {
      callback(null, item);
    }
  }

  createNodeWithAsin(asin: string, callback: CallbackFn) {
    const self = this;
    this.limiter.removeTokens(1, (err) => {
      if (err) {
        return callback(err, null);
      }
      self.callProdAdv("ItemLookup", { ItemId: asin }, (err, result) => {
        if (err) {
          return callback(err, null);
        }
        self.db.createBookNode(result.Items.Item, callback);
      });
    });
  }

  keywordSearch(keyword: string, responseGroup: string, callback: CallbackFn) {
    this.callProdAdv(
      "ItemSearch",
      { Keywords: keyword, ResponseGroup: responseGroup },
      callback
    );
  }

  // client is a Product Advertising API client -- see lib/crawl_queue.js
  // author is an author's full name
  // callback(err, result)
  // result is an array of ASIN strings, eg ["B014V4DXMW", "B003E4DFJJ"]
  // TODO: this search result includes price; add it to DB
  resultsForAuthor(author: string, callback: CallbackFn) {
    this.callProdAdv(
      "ItemSearch",
      { Author: author, SearchIndex: "KindleStore", ResponseGroup: "Medium" },
      (err, result) => {
        if (err) {
          return callback(err, []);
        }
        if (!result.Items) {
          callback(new Error("Search response did not contain any items"), []);
        }
        return callback(null, result.Items.Item);
      }
    );
  }
}
