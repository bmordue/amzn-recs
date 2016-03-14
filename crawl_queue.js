require("dotenv").load( {silent: true});
var async = require("async");
var aws = require("aws-lib");
var util = require("util");

var fail = function() {
	throw new Error("Missing required env var");
};

function CrawlQueue(options) {
	this.maxCrawlDepth = options.maxCrawlDepth || 2;
	console.log("maxCrawlDepth: " + this.maxCrawlDepth);
	
	var keyId = process.env.AMZN_ACCESS_KEY_ID || fail();
	var keySecret = process.env.AMZN_ACCESS_KEY_SECRET || fail();
	var associateTag = process.env.AMZN_ASSOCIATE_TAG || fail();

	this.prodAdv = aws.createProdAdvClient(keyId, keySecret, associateTag, { host: "webservices.amazon.co.uk"});
}

CrawlQueue.prototype.crawl = function(rootAsin, depth, callback) {
	console.log(util.format("Current crawl depth: %s, parent node ASIN ", this.currentDepth, rootAsin));
	var self = this;
	this.prodAdv.call("SimilarityLookup", { ItemId: rootAsin }, function(err, result) {
		if (err) {
			return callback(err);
		}
		depth += 1;
		if (depth > self.maxCrawlDepth) {
			console.log(util.format("Reached depth %s, stop crawling", self.currentDepth));
			return callback();
		}
		// console.log(JSON.stringify(result));
		async.each(result.Items.Item, function(item, each_cb) {
			self.crawl(item.ASIN, depth, each_cb);
		}, callback);
	});		
};

module.exports = CrawlQueue;
