// populate graph DB from JSON files
require("dotenv").load({silent: true});
var async = require("async");
var CrawlQueue = require("../lib/crawl_queue");
var DbConnector = require("../lib/db_connector");
var fs = require("fs");
var log = require("../lib/log");
var path = require("path");
var priceAsin = require("../lib/price-for-asin");
var RateLimiter = require("limiter").RateLimiter;
var util = require("util");

var dbCon = new DbConnector();
var limiter = new RateLimiter(1, "second");

var nodes_count = 0;

function throttledPriceLookup (asin, callback) {
	limiter.removeTokens(1, function(err, remaining) {
		if (err) {
			return callback(err);
		}
		priceAsin.fetch(asin, callback);
	});
}

function processItem(parentAsin, item, callback) {
	nodes_count++;
	throttledPriceLookup(item.ASIN, function(err, result) {
		if (err) {
			log.error({error: err.message}, "error looking up price for ASIN " + item.ASIN);
		}
		if (result) {
			item.price = result.price;
			item.currency = result.currency;
		}
		dbCon.createChildBookNodeAndRelations(parentAsin, item, function(err, result) {
			if (err) {
				log.error({error: err.message, item: item}, "populate.processItem() - error adding node: ");
				return callback(err);
			}
			callback();
		});
	});
}

// move files out of the input folder once they've been processed
// move to doneDir if successful, or errorDir if not
function moveInputFile(cb, filename, err) {
	var newPath;
	if (err) {
		newPath = path.join(CrawlQueue.errorDir, filename);
	} else {
		newPath = path.join(CrawlQueue.doneDir, filename);
	}
	fs.rename(path.join(CrawlQueue.inputDir, filename), newPath, function(renameErr) {
		// if there's a problem moving the file, log it, but don't fail
		if (renameErr) {
			log.error({err: renameErr, file: filename}, "Error while moving input file");
		}
		cb(err);
	});
}

function processFile(filename, cb) {
	var callback = moveInputFile.bind(this, cb, filename);
	if (filename.length != 15 || filename.slice(-5) != ".json") {
		return callback(); // primitive filter for interesting files
	}
	var parentAsin = filename.slice(0,-5); // asin.JSON -> asin
	fs.readFile(path.join(CrawlQueue.inputDir, filename), function(err, data) {
		if (err) {
			return callback(err);
		}
		log.info(filename, "read file ");
		var item_list = [];
		try {
			item_list = JSON.parse(data).Items.Item;
		} catch (e) {
			return callback(e);
		}
		//log.debug(item_list, "item_list: ")
		async.each(item_list, function(item, each_cb) {
			processItem(parentAsin, item, each_cb);
		}, callback);
	});
}

function populate(callback) {
	// expect inputDir directory to be filled with files named like "B00TOOSCC6.json"
	fs.readdir(CrawlQueue.inputDir, function(err, files) {
		if (err) {
			return callback(err);
		}
		log.info(files.length, "files found: ");
		// TODO: use async.queue instead of async.each -- with large number of files, all
		// will be opened at the same time...
		async.each(files, processFile, callback);
	});
}

function main() {
	async.waterfall([
		function(cb) { fs.mkdir(CrawlQueue.doneDir, cb); },
		function(cb) { fs.mkdir(CrawlQueue.errorDir, cb); },
	], function(err) {
		if (err) {
			log.error(err, "Error creating doneDir or errorDir directory")// log but otherwise ignore
		}
		populate(function(err) {
			if (err) {
				log.error(err, "Error");
				process.exit(1);
			}
			log.info(nodes_count, "Node count: ");
		});
	});
}

main();
