var CrawlQueue = require("./lib/crawl_queue");
var log = require("./lib/log")
var util = require("util");

var main = function() {
	var maxDepth = process.argv[2] || 2;
	
	var rootAsin = 'B014V4DXMW'; //starting ASIN
	var crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
	crawler.crawl(rootAsin, 0, function(err) {
		if (err) {
			log.error(err, "Error");
			log.error(err.stack, "stack");
			process.exit(1);
		}
		log.info(crawler.nodeCount, " nodes crawled");
		process.exit(0);
	});
};

main();
