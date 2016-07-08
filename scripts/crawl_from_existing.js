// crawl prod adv API and write results to JSON files
var CrawlQueue = require("../lib/crawl_queue");
var fs = require("fs");
var log = require("../lib/log")
var util = require("util");

var exit = function(err) {
	if (err) {
		log.error(err, "Error");
		log.error(err.stack, "stack");
		process.exit(1);
	}
	log.info("Crawl completed successfully.");
	process.exit(0);
}

var main = function() {
	var maxDepth = process.argv[2] || 2;
	var existing_asins = fs.readdir("output", function(err, files) {
		if (err) {
			log.error("Could not read directory contents");
			return exit(err);
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
			crawl_errors.forEach(function(error) {
				log.error(error, "Crawl error");
			});
			return exit(new Error(util.format("%s errors while crawling", crawl_errors.length)));
		}
		exit();
	});
};

main();
