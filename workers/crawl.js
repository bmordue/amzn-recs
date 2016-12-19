// crawl prod adv API and write results to JSON files
var async = require("async");
var CrawlQueue = require("../lib/crawl_queue");
var log = require("../lib/log")
var MessageQueue = require("../lib/message_queue");
var util = require("util");

const DEFAULT_CRAWL_DEPTH = 2;

var work = function(callback) {
	var queue = new MessageQueue({dbPath: './temp/db.sqlite'});
	var task = {};
	var crawler;
	async.waterfall([
			function(cb) { queue.init(cb); },
			function(cb) { queue.claim(cb); },
		function(result, cb) {
			if (!result) {
				return cb(new Error("Failed to retrieve a task from queue"));
			}
			task = result;
			var maxDepth = task.depth || DEFAULT_CRAWL_DEPTH;
			var rootAsin = task.asin;
			if (!rootAsin) {
				var errMsg = "Task did not contain an ASIN";
				log.error(task, errMsg);
				return cb(new Error(errMsg));
			}
			crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
			crawler.crawl(rootAsin, 0, cb);
		}],
		function(err, result) {
			log.debug({err: err, result: result}, "debug");
			if (err) {
				log.error({error: err, task: task}, "Encountered an error; unclaim the task");
				queue.unclaim(task.rowid, callback);
			} else {
				queue.complete(task.rowid, callback);
			}
		});
};

var main = function() {
	work(function(err) {
		if (err) {
			log.error(err, "Error");
			log.error(err.stack, "stack");
			process.exit(1);
		} else {
			process.exit();
		}
	});
};

main();
