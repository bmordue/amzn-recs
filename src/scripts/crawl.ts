// crawl prod adv API and write results to JSON files
import { CrawlQueue } from "../lib/crawl_queue";
import log = require("../lib/log");

const main = function() {
	const rootAsin = process.argv[2]; //starting ASIN
	if (!rootAsin) {
		log.error({}, "Missing required argument: starting ASIN");
		process.exit(1);
	}

	const maxDepth = process.argv[3] || 2;

	const crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
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
