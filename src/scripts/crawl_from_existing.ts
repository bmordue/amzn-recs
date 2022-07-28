import { CrawlQueue } from "../lib/crawl_queue";
import log = require("../lib/log")
import util = require("util");


const checkAndCallback = function(errors, callback) {
  if (errors.length) {
    log.error({errors: errors}, util.format("%s errors while crawling", errors.length));
    return callback(new Error("Errors while crawling"));
  }
  callback();
};

// cb(err)
const crawl_from_existing = function(callback) {
  const maxDepth = process.argv[2] || 2;
  const maxNodes = process.argv[3] || 10; // how many existing nodes to crawl
  const crawler = new CrawlQueue({maxCrawlDepth: maxDepth, doPriceLookup: false});
  crawler.db.listLeafNodeAsins(function(err, leaf_nodes) {
    if (err) {
      return callback(err);
    }
    const crawl_errors = [];
    const max = maxNodes > leaf_nodes.length ? leaf_nodes.length : maxNodes;
    let done = 0;
    log.debug(leaf_nodes.length, 'Found leaf nodes');
    log.debug({count: max}, "Start crawling nodes");

    const crawlerCb = function(err) {
      if (err) { crawl_errors.push(err); }
      done++;
      if (done == max) {
        return checkAndCallback(crawl_errors, callback);
      }
    };

    for (let i = 0; i < max; i++) {
      if (!leaf_nodes[i] || !leaf_nodes[i].get('asin')) {
        log.debug(leaf_nodes[i], 'Skipping leaf node ' + i);
        continue;
      }

      const asin = leaf_nodes[i].get('asin');
      log.debug({asin: asin}, "leaf node ASIN");
      crawler.crawl(asin, 0, crawlerCb);
    }
  });
};

const main = function() {
  crawl_from_existing(function(err) {
    if (err) {
      log.error(err, "crawl_from_existing.js finished with error");
      process.exit(1);
    } else {
      log.info({}, "crawl_from_existing.js finished successfully");
      process.exit();
    }
  });
};

main();
