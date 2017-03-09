// crawl prod adv API and write results to JSON files
var CrawlQueue = require("../lib/crawl_queue");
var log = require("../lib/log");
var util = require("util");

var main = function() {
	var rootAsin = process.argv[2]; //starting ASIN
	if (!rootAsin) {
		log.error({}, "Missing required argument: starting ASIN");
		process.exit(1);
	}
	
	var maxDepth = process.argv[3] || 2;
	
	var crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
	log.info({root: rootAsin, depth: maxDepth}, "Start crawling...");
	crawler.crawl(rootAsin, 0, function(err) {
		if (err) {
			log.error(err, "Error in scripts/crawl.js");
			log.error(err.stack, "stack");
			process.exit(1);
		}
		log.info({total: crawler.nodeCount}, "Crawled nodes");
	});
};

main();
