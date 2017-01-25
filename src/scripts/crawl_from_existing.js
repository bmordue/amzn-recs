// crawl prod adv API
var async = require("async");
var CrawlQueue = require("../lib/crawl_queue");
var fs = require("fs");
var log = require("../lib/log")
var util = require("util");


var checkAndCallback = function(errors, callback) {
	if (errors.length) {
		log.error({errors: crawl_errors}, util.format("%s errors while crawling", crawl_errors.length));
		return callback(new Error("Errors while crawling"));
	}
	callback();
}

// cb(err)
var crawl_from_existing = function(callback) {
	var maxDepth = process.argv[2] || 2;
	var maxNodes = process.argv[3] || 10; // how many existing nodes to crawl
	var crawler = new CrawlQueue({maxCrawlDepth: maxDepth, doPriceLookup: false});
	crawler.db.listLeafNodeAsins(function(err, leaf_nodes) {
		if (err) {
			return callback(err);
		}
		var crawl_errors = [];
		var max = maxNodes > leaf_nodes.length ? leaf_nodes.length : maxNodes;
		var done = 0;
		log.debug({count: max}, "Start crawling nodes");
		for (var i = 0; i < max; i++) {
			var asin = leaf_nodes[i].asin;
			log.debug({asin: asin}, "leaf node ASIN");
			crawler.crawl(asin, 0, function(err) {
				if (err) {
					crawl_errors.push(err);
				}
				done++;
				if (done == max) {
					checkAndCallback(crawl_errors, callback);
				}
			});
		}
	});
};

var main = function() {
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
