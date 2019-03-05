var CrawlQueue = require("../lib/crawl_queue");
var log = require("../lib/log")
var util = require("util");


var checkAndCallback = function(errors, callback) {
	if (errors.length) {
		log.error({errors: errors}, util.format("%s errors while crawling", errors.length));
		return callback(new Error("Errors while crawling"));
	}
	callback();
};

// cb(err)
var crawl_from_existing = function(callback) {
	var maxDepth = process.argv[2] || 2;
	var maxNodes = process.argv[3] || 10; // how many existing nodes to crawl
	var crawler = new CrawlQueue({maxCrawlDepth: maxDepth, doPriceLookup: true});
	crawler.db.listLeafNodeAsins(function(err, leaf_nodes) {
		if (err) {
			return callback(err);
		}
		var crawl_errors = [];
		var max = maxNodes > leaf_nodes.length ? leaf_nodes.length : maxNodes;
		var done = 0;
		log.debug(leaf_nodes.length, 'Found leaf nodes');
		log.debug({count: max}, "Start crawling nodes");

		for (var i = 0; i < max; i++) {
			if (!leaf_nodes[i] || !leaf_nodes[i].get('asin')) {
				log.debug(leaf_nodes[i], 'Skipping leaf node ' + i);
				continue;
			}

			var asin = leaf_nodes[i].get('asin');
			log.debug({asin: asin}, "leaf node ASIN");
			crawler.crawl(asin, 0, function(err) {
				if (err) {
					crawl_errors.push(err);
				}
				done++;
				if (done == max) {
					return checkAndCallback(crawl_errors, callback);
				}
			});
		}
//		log.warn({}, "Did not expect to reach this");
//		checkAndCallback(crawl_errors, callback);
	});
};

var main = function() {
	crawl_from_existing(function(err) {
		if (err) {
			log.error(err, "crawl_from_existing.js finished with error");
			console.log(err.stack);
			process.exit(1);
		} else {
			log.info({}, "crawl_from_existing.js finished successfully");
			process.exit();
		}
	});
};

main();
