// Crawl based on search for author
// The intent is to populate the DB with all titles by an author
var async = require("async");
var CrawlQueue = require("../lib/crawl_queue");
var log = require("../lib/log");
var util = require("util");

// client is a Product Advertising API client -- see lib/crawl_queue.js
// author is an author's full name
// callback(err, result)
// result is an array of ASIN strings, eg ["B014V4DXMW", "B003E4DFJJ"]
// TODO: move this into lib/crawl_queue.js
// TODO: this search result includes price; add it to DB
function resultsForAuthor(client, author, callback) {
	client.call("ItemSearch", { Author: author, SearchIndex: "KindleStore", ResponseGroup: "Medium"}, function(err, result) {

		if (err) {
			return callback(err, []);
		}
		if (!result.Items) {
			callback(new Error("Search response did not contain any items"), [])
		}
		return callback(null, result.Items.Item);
	});
}

var main = function() {
	var author = process.argv[2]; //eg "Neal Stephenson"
	if (!author) {
		log.error({}, "Missing required argument: author");
		process.exit(1);
	}
	var depth = process.argv[3] || 1;

	var crawler = new CrawlQueue({maxCrawlDepth: depth});

	resultsForAuthor(crawler.prodAdv, author, function(err, items) {
		log.info({author: author, titles: items.length}, "Number of titles found");
		async.each(items, function(item, cb) {
			log.debug(item.ItemAttributes, "Title by author");
			crawler.db.createBookNode(item, function(err) {
				log.debug({}, 'Called back from createChildBookNode');
				if (err) {
					log.warn({error: err, data: item}, "Could not create book node"); // log error, but continue anyway
				}
				crawler.crawl(item.ASIN, 0, cb);
			});
		},
		function(err) {
			if (err) {
				log.error(err, "Error");
				log.error(err.stack, "stack");
				process.exit(1);
			}
			process.exit(0);
		});
	});
};

main();
