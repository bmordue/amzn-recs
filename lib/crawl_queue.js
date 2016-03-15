require("dotenv").load({silent: true});
var async = require("async");
var aws = require("aws-lib");
var DbConnector = require("./db_connector");
var RateLimiter = require("limiter").RateLimiter;
var util = require("util");

var fail = function() {
	throw new Error("Missing required env var");
};

function CrawlQueue(options) {
	if (!options) {
		options = {};
	} 
	this.maxCrawlDepth = options.maxCrawlDepth || 2;
	this.nodeCount = 0;
	console.log("maxCrawlDepth: " + this.maxCrawlDepth);
	
	var keyId = process.env.AMZN_ACCESS_KEY_ID || fail();
	var keySecret = process.env.AMZN_ACCESS_KEY_SECRET || fail();
	var associateTag = process.env.AMZN_ASSOCIATE_TAG || fail();

	this.prodAdv = aws.createProdAdvClient(keyId, keySecret, associateTag, { host: "webservices.amazon.co.uk"});
	this.limiter = new RateLimiter(1, "second");
	this.db = new DbConnector();
}

CrawlQueue.prototype.throttledSimilarityLookup = function(asin, callback) {
	var self = this;
	this.limiter.removeTokens(1, function(err, remaining) {
		self.prodAdv.call("SimilarityLookup", { ItemId: asin }, callback);
	});
};

CrawlQueue.prototype.alreadyCrawled = function(asin, callback) {
	this.db.getNode(asin, function(err, node) {
		if (err) {
			return callback(err);
		}
		if (!node) {
			return callback(null, {crawled: false});
		}
		node.countOutgoingRecommendations(function(err, result) {
			if (err) {
				return callback(err);
			}
			if (!result.outgoing) {
				return callback(null, {crawled: false});
			}
			callback(null, {crawled: true});
		});
		
	});
};

CrawlQueue.prototype.crawl = function(rootAsin, depth, callback) {
	this.nodeCount++;
	console.log(util.format("Current crawl depth: %s, parent node ASIN ", depth, rootAsin));
	var self = this;
	depth += 1;
	if (depth > self.maxCrawlDepth) {
		// console.log(util.format("Reached depth %s, stop crawling", depth));
		return callback();
	}
	this.throttledSimilarityLookup(rootAsin, function(err, result) {
		if (err) {
			return callback(err);
		}
		console.log(JSON.stringify(result));
		var uncrawledItems = result.Items.Item;
		
		async.each(uncrawledItems, function(item, each_cb) {
			self.alreadyCrawled(item.ASIN, function(err, result) {
				if (err) {
					return callback(err);
				}
				if (!result.crawled) {
					self.crawl(item.ASIN, depth, each_cb);
				} else {
					console.log(util.format("Already crawled %s", item.ASIN));
					each_cb();
				}
			});
		}, callback);
	});
};

module.exports = CrawlQueue;
