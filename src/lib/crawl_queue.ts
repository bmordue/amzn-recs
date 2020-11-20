import async = require("async");
import aws = require("aws-lib");
import config = require("./config");
import { DbConnector } from "./graphdb_connector";
import log = require("./log");
import { fetch } from "./price_connector";
import { RateLimiter } from "limiter";
import StatsD = require("node-statsd");
import util = require("util");

const statsd = new StatsD({
                        prefix: 'amzn-recs.crawl_queue.',
                        host: config.get('STATSD_HOST')
                });

import { fakeProdAdv } from "./fake_prodadv";

const BACKOFF_SECONDS = 10;

function callProdAdv(crawlQueue, query, params, callback) {
	statsd.increment("call_product_advertising_api");

	crawlQueue.prodAdv.call(this, query, params, callback);
}

export class CrawlQueue {
static inputDir = './temp/output';
static doneDir = './temp/done';
static errorDir = './temp/errors';


	private maxCrawlDepth;
	nodeCount;
	private doPriceLookup;
	prodAdv;
	private limiter;
	db;
	
	constructor(options) {
	if (!options) {
		options = {};
	}
	this.maxCrawlDepth = options.maxCrawlDepth || 2;
	this.nodeCount = 0;
	log.debug({}, "maxCrawlDepth: " + this.maxCrawlDepth);

	this.doPriceLookup = options.doPriceLookup;
	if (!this.doPriceLookup) {
		log.info({}, "Price lookup is not enabled");
	}

	const keyId = config.get("AMZN_ACCESS_KEY_ID");
	const keySecret = config.get("AMZN_ACCESS_KEY_SECRET");
	const associateTag = config.get("AMZN_ASSOCIATE_TAG");
	const amazonServiceHost = config.get("AMZN_SERVICE_HOST");

	if (keyId && keySecret && associateTag) {
		this.prodAdv = aws.createProdAdvClient(keyId, keySecret, associateTag, { host: amazonServiceHost});
		log.info({}, "Created prodAdv client");
	} else {
		this.prodAdv = fakeProdAdv;
		log.info({}, "Using fakeProdAdv");
	}
//	this.limiter = new RateLimiter(50, "minute");
	this.limiter = new RateLimiter(1, 3000); // 1 every N ms
	this.db = new DbConnector();
}

throttledSimilarityLookup(asin, callback) {
	const self = this;
	log.debug({}, 'throttledSimilarityLookup');
	this.limiter.removeTokens(1, function(err) {
		log.debug({}, 'called back from limited');
		if (err) {
			return callback(err);
		}
		callProdAdv(self, "SimilarityLookup", { ItemId: asin }, function(err, data) {
			if (err && err.message.indexOf('submitting requests too quickly') != -1) {
				log.warn({err: err}, "Submitting requests too quickly; back off and retry");
				setTimeout(function() {
					return self.throttledSimilarityLookup(asin, callback);
				}, BACKOFF_SECONDS);
			} else {
				return callback(err, data);
			}
		});
	});
};

throttledPriceLookup(asin, callback) {
	if (!this.doPriceLookup) {
		return callback(null, {});
	}
	this.limiter.removeTokens(1, function(err) {
		if (err) {
			return callback(err);
		}
		fetch(asin, callback);
	});
};


alreadyCrawled(asin, callback) {
	const self = this;
	this.db.getBookNode(asin, function(err, node) {
		if (err) {
			return callback(err);
		}
		if (!node) {
			return callback(null, {crawled: false});
		}
		self.db.countOutgoingRecommendations(asin, function(err, result) {
			if (err) {
				return callback(err);
			}
			if (!result.outgoing) {
				return callback(null, {crawled: false});
			}
			callback(null, {crawled: true});
		});

	});
};

crawl(rootAsin, depth, callback) {

	this.nodeCount++;
	log.debug({current_depth: depth, parent_node: rootAsin}, "crawling");
	const self = this;
	depth += 1;
	if (depth > self.maxCrawlDepth) {
		log.debug({}, util.format("Reached depth %s, stop crawling", depth));
		return callback();
	}
	const nodesAdded = [];
	async.waterfall([
		function(cb) {
			self.throttledSimilarityLookup(rootAsin, cb);
		},
		function(similar, cb) {
			if (!similar.Items || !similar.Items.Item) {
				log.info({asin: rootAsin}, "Similar items list is empty");
				return cb();
			}
			log.debug({asin: rootAsin, child_count: similar.Items.Item.length}, "Start crawling children");
			async.each(similar.Items.Item, function(item, each_cb) {
				async.waterfall([
					function(cb) {
						nodesAdded.push(item);
						self.addToGraph(rootAsin, item, cb);
					},
					function(cb) {
						self.crawl(item.ASIN, depth, cb);
					}
				], function(err) {
					log.debug({asin: item.ASIN}, "Finished walking child node");
					each_cb(err);
				});
			}, cb);
		}
	], function(err) {
		log.debug({asin: rootAsin}, "Finished crawling");
		callback(err, nodesAdded);
	});
};

addToGraph(parent, item, callback) {
	const self = this;
	self.ensureRequiredFields(parent, item, function(err) {
		if (err) {
			log.error(item, 'Could not add required fields for graph node');
			return callback(err);
		}

		self.throttledPriceLookup(item.ASIN, function(err, result) {
			if (err) {
				log.error({error: err.message}, "error looking up price for ASIN " + item.ASIN);
				// add to graph without price, so drop this error
			}
			if (result) {
				item.price = result.price;
				item.currency = result.currency;
			}
			self.db.createChildBookNodeAndRelations(parent, item, function(err, result) {
				log.debug({result: result}, "Finished creating node and relations");
				// drop result to not cause problems at next step
				callback(err);
			});
		});
	});
};

ensureRequiredFields(parent, item, callback) {
	const self = this;
	if (!item.Title || !item.Author || !item.DetailPageUrl) {
		log.debug(item, 'Missing required field; attempt to add it');
		this.limiter.removeTokens(1, function(err) {
			if (err) {
				return callback(err);
			}
			callProdAdv(self, "ItemLookup", { ItemId: item.ASIN }, function(err, result) {
				if (err) {
					return callback(err);
				}
				return callback(null, result.Items.Item);
			});
		});
	} else {
		callback(null, item);
	}
};

createNodeWithAsin(asin, callback) {
	const self = this;
	this.limiter.removeTokens(1, function(err) {
		if (err) {
			return callback(err);
		}
		callProdAdv(self, "ItemLookup", { ItemId: asin }, function(err, result) {
			if (err) {
				return callback(err);
			}
			self.db.createBookNode(result.Items.Item, callback);
		});
	});
};

keywordSearch(keyword, responseGroup, callback) {
	callProdAdv(this, "ItemSearch", { Keywords: keyword, ResponseGroup: responseGroup }, callback);
};


}
