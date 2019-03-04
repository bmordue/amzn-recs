require("dotenv").load({silent: true});
var async = require("async");
var aws = require("aws-lib");
var config = require("./config");
var DbConnector = require("./graphdb_connector");
var log = require("./log");
var priceAsin = require("./price_connector");
var RateLimiter = require("limiter").RateLimiter;
var StatsD = require("node-statsd");
var util = require("util");

var statsd = new StatsD({
                        prefix: 'amzn-recs.crawl_queue.',
                        host: process.env.STATSD_HOST ? process.env.STATSD_HOST : 'localhost'
                });


const BACKOFF_SECONDS = 10;

function callProdAdv(crawlQueue, query, params, callback) {
	statsd.increment("call_product_advertising_api");
	crawlQueue.prodAdv.call(query, params, callback);
}

function CrawlQueue(options) {
	if (!options) {
		options = {};
	}
	this.maxCrawlDepth = options.maxCrawlDepth || 2;
	this.nodeCount = 0;
	log.debug({}, "maxCrawlDepth: " + this.maxCrawlDepth);

	this.doPriceLookup = options.doPriceLookup;
	if (!this.doPriceLookup) {
		log.info({}, "Price lookup is not enabled");
	}

	var keyId = config.get("AMZN_ACCESS_KEY_ID");
	var keySecret = config.get("AMZN_ACCESS_KEY_SECRET");
	var associateTag = config.get("AMZN_ASSOCIATE_TAG", true);
	var amazonServiceHost = config.get("AMZN_SERVICE_HOST") || "webservices.amazon.co.uk";

	this.prodAdv = aws.createProdAdvClient(keyId, keySecret, associateTag, { host: amazonServiceHost});
	this.limiter = new RateLimiter(50, "minute");
	this.db = new DbConnector();
}

CrawlQueue.prototype.throttledSimilarityLookup = function(asin, callback) {
	var self = this;
	this.limiter.removeTokens(1, function(err) {
		if (err) {
			return callback(err);
		}
		callProdAdv(self, "SimilarityLookup", { ItemId: asin }, function(err, data) {
			if (err && err.message.indexOf('submitting requests too quickly') != -1) {
				log.warn({err: err}, "Submitting requests too quickly; back off and retry");
				setTimeout(function() {
					return self.throttledSimilarityLookup(asin, callback);
				}, BACKOFF_SECONDS);
			} else {
				return callback(err, data);
			}
		});
	});
};

CrawlQueue.prototype.throttledPriceLookup = function(asin, callback) {
	if (!this.doPriceLookup) {
		return callback(null, {});
	}
	this.limiter.removeTokens(1, function(err) {
		if (err) {
			return callback(err);
		}
		priceAsin.fetch(asin, callback);
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
	log.debug({current_depth: depth, parent_node: rootAsin}, "crawling");
	var self = this;
	depth += 1;
	if (depth > self.maxCrawlDepth) {
		log.debug({}, util.format("Reached depth %s, stop crawling", depth));
		return callback();
	}
	async.waterfall([
		function(cb) {
			self.throttledSimilarityLookup(rootAsin, cb);
		},
		function(similar, cb) {
			if (!similar.Items.Item) {
				log.warn({asin: rootAsin}, "Similar items list is empty");
				return cb();
			}
			log.debug({asin: rootAsin, child_count: similar.Items.Item.length}, "Start crawling children");
			async.each(similar.Items.Item, function(item, each_cb) {
				async.waterfall([
					function(cb) {
						//write into graph db
						self.throttledPriceLookup(item.ASIN, function(err, result) {
							if (err) {
								log.error({error: err.message}, "error looking up price for ASIN " + item.ASIN);
								// add to graph without price, so drop this error
							}
							if (result) {
								item.price = result.price;
								item.currency = result.currency;
							}
							self.db.createChildBookNodeAndRelations(rootAsin, item, function(err, result) {
							    log.debug({result: result}, "Finished creating node and relations");
								// drop result to not cause problems at next step
								cb(err);
							});
						});
					},
					function(cb) {
						self.crawl(item.ASIN, depth, cb);
					}
				], function(err) {
					log.debug({asin: item.ASIN}, "Finished walking child node");
					each_cb(err);
				});
			}, cb);
		}
	], function(err) {
		log.debug({asin: rootAsin}, "Finished crawling");
		callback(err);
	});
};

CrawlQueue.prototype.createNodeWithAsin = function(asin, callback) {
	var self = this;
	this.limiter.removeTokens(1, function(err) {
		if (err) {
			return callback(err);
		}
		callProdAdv(self, "ItemLookup", { ItemId: asin }, function(err, result) {
			if (err) {
				return callback(err);
			}
			self.db.createBookNode(result.Items.Item, callback);
		});
	});
};

CrawlQueue.prototype.keywordSearch = function(keyword, responseGroup, callback) {
	callProdAdv(this, "ItemSearch", { Keywords: keyword, ResponseGroup: responseGroup }, callback);
};

CrawlQueue.inputDir = '/temp/output';
CrawlQueue.doneDir = '/temp/done';
CrawlQueue.errorDir = '/temp/errors';


module.exports = CrawlQueue;
