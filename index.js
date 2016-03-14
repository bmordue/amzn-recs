var CrawlQueue = require("./crawl_queue");

var main = function() {
	var rootAsin = 'B014V4DXMW'; //starting ASIN
	var crawler = new CrawlQueue({maxCrawlDepth: 1});
	crawler.crawl(rootAsin, 0, function(err) {
		if (err) {
			console.log(err);
			process.exit(1);
		}
		process.exit(0);
	});
};

main();
