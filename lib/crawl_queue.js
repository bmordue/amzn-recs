require("dotenv").load({silent: true});
var async = require("async");
var aws = require("aws-lib");
var DbConnector = require("./db_connector");
var fs = require("fs");
var log = require("./log");
var path = require("path");
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
	log.debug({}, "maxCrawlDepth: " + this.maxCrawlDepth);
	
	var keyId = process.env.AMZN_ACCESS_KEY_ID || fail();
	var keySecret = process.env.AMZN_ACCESS_KEY_SECRET || fail();
	var associateTag = process.env.AMZN_ASSOCIATE_TAG || fail();
	var amazonServiceHost = process.env.AMZN_SERVICE_HOST || "webservices.amazon.co.uk";

	this.prodAdv = aws.createProdAdvClient(keyId, keySecret, associateTag, { host: amazonServiceHost});
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
	var self = this;
	this.db.getBookNode(asin, function(err, node) {
		if (err) {
			return callback(err);
		}
		if (!node) {
			return callback(null, {crawled: false});
		}
		self.db.countOutgoingRecommendations(asin, function(err, result) {
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
	log.debug({current_depth: depth, parent_node: rootAsin}, util.format("crawling");
	var self = this;
	depth += 1;
	if (depth > self.maxCrawlDepth) {
		log.debug({}, util.format("Reached depth %s, stop crawling", depth));
		return callback();
	}
	this.throttledSimilarityLookup(rootAsin, function(err, result) {
		if (err) {
			return callback(err);
		}
		var filename = path.join("output", rootAsin + ".json");
		fs.stat(filename, function(err, stats) {
			if (err && err.code == "ENOENT") {
				try {
					fs.writeFileSync(filename, JSON.stringify(result, null, 4));
				} catch (e) {
					log.error("Couldn't write file");
					return callback(e);
				}
			}
			async.each(result.Items.Item, function(item, each_cb) {
				self.crawl(item.ASIN, depth, each_cb);
			}, callback);
		});
	});
};

CrawlQueue.prototype.createNodeWithAsin = function(asin, callback) {
	var self = this;
	this.prodAdv.call("ItemLookup", { ItemId: asin }, function(err, result) {
		self.db.createBookNode(result.Items.Item, callback);
	});
};

CrawlQueue.prototype.keywordSearch = function(keyword, responseGroup, callback) {
	this.prodAdv.call("ItemSearch", { Keywords: keyword, ResponseGroup: responseGroup }, callback); 
};


module.exports = CrawlQueue;
