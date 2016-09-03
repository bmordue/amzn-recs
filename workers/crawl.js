// crawl prod adv API and write results to JSON files
var CrawlQueue = require("../lib/crawl_queue");
var log = require("../lib/log")
var MessageQueue = require("../lib/message_queue");
var util = require("util");

const DEFAULT_CRAWL_DEPTH = 2;

var work = function(callback) {
	queue = new MessageQueue();
	queue.init(function(err) {
		if (err) {
			return callback(err);
		}
		queue.shift(function(err, task) {
			if (err) {
				return callback(err);
			}
			if (!task) {
				return callback(new Error("Failed to retrieve a task from queue"));
			}
			var maxDepth = task.depth || DEFAULT_CRAWL_DEPTH;
			var rootAsin = task.asin;
			if (!rootAsin) {
				var errMsg = "Task did not contain an ASIN";
				log.error(task, errMsg);
				return callback(new Error(errMsg));
			}
			var crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
			crawler.crawl(rootAsin, 0, function(err) {
				if (err) {
					queue.add(task);
				}
				return callback(err);
			});
		});
	});
};

var main = function() {
	work(function(err) {
		if (err) {
			log.error(err, "Error");
			log.error(err.stack, "stack");
			process.exit(1);
		}
	});
};

main();
