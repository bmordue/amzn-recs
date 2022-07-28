// crawl prod adv API and write results to JSON files
import async = require("async");
import config = require("../lib/config");
import { CrawlQueue } from "../lib/crawl_queue";
import log = require("../lib/log");
import { MessageQueue } from "../lib/message_queue";

const DEFAULT_CRAWL_DEPTH = 2;

const work = function(callback) {
  const queue = new MessageQueue({dbPath: config.get("DB_PATH")});
  let task = {
    depth: null,
    asin: null,
    rowid: null
  };
  let crawler;
  async.waterfall([
      function(cb) {
        queue.init(cb);
      },
      function(cb) {
        queue.claim(cb);
      },
    function(result, cb) {
      if (!result) {
        return cb(new Error("Failed to retrieve a task from queue"));
      }
      task = result;
      const maxDepth = task.depth || DEFAULT_CRAWL_DEPTH;
      const rootAsin = task.asin;
      if (!rootAsin) {
        const errMsg = "Task did not contain an ASIN";
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

const main = function() {
  work(function(err) {
    if (err) {
      log.error(err, "Error in workers/crawl.js#work()");
      log.error(err.stack, "stack");
      process.exit(1);
    } else {
      process.exit();
    }
  });
};

main();
