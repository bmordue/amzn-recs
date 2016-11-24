// crawl prod adv API and write results to JSON files
// does not make any changes to graph DB
var CrawlQueue = require("../lib/crawl_queue");
var fs = require("fs");
var log = require("../lib/log")
var util = require("util");

var main = function() {
	var maxDepth = process.argv[2] || 2;
	var existing_asins = fs.readdir(CrawlQueue.inputDir, function(err, files) {
		if (err) {
			log.error("Could not read directory contents");
			process.exit(1);
		}
		var existing_asins = files.map(function(filename) {
			return filename.slice(0, -5);
		});
		var crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
		var crawl_errors = [];
		existing_asins.forEach(function(asin) {
			log.debug({root: asin}, "Start crawling");
			crawler.crawl(asin, 0, function(err) {
				if (err) {
					crawl_errors.push(err);
				}
				log.debug({root: asin, count: crawler.nodeCount}, "Finished crawling for one root node");
			});
		});
		if (crawl_errors.length) {
			log.error({errors: crawl_errors}, util.format("%s errors while crawling", crawl_errors.length));
		}
	});
};

main();
