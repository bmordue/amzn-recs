var CrawlQueue = require("./lib/crawl_queue");
var util = require("util");

var main = function() {
	var maxDepth = process.argv[2] || 2;
	
	var rootAsin = 'B014V4DXMW'; //starting ASIN
	var crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
	crawler.crawl(rootAsin, 0, function(err) {
		if (err) {
			console.log(err);
			process.exit(1);
		}
		console.log(util.format('Found %s nodes', crawler.nodeCount));
		process.exit(0);
	});
};

main();
