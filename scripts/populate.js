// populate graph DB from JSON files
require("dotenv").load({silent: true});
var async = require("async");
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
		priceAsin.fetch(asin, callback);
	});
}

function processItem(parentAsin, item, callback) {
	nodes_count++;
	throttledPriceLookup(item.ASIN, function(err, result) {
		if (err) {
			log.error(err, "error looking up price for ASIN " + item.ASIN);
		} else {
			item.price = result.price;
			item.currency = result.currency;
		}
		dbCon.createChildBookNodeAndRelations(parentAsin, item, function(err, result) {
			if (err) {
				log.error(item, "error adding node: ");
				return callback(err);
			}
			callback();
		});
	});
}

function processFile(filename, callback) {
	if (filename.length != 15 || filename.slice(-5) != ".json") {
		return callback(); // primitive filter for interesting files
	}
	var parentAsin = filename.slice(0,-5); // asin.JSON -> asin
	fs.readFile(path.join("output", filename), function(err, data) {
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
	// expect dir output to be filled with files like "B00TOOSCC6.json"
	fs.readdir("output", function(err, files) {
		if (err) {
			return callback(err);
		}
		log.info(files.length, "files found: ");
		async.each(files, processFile, callback);
	});
}

function main() {
	populate(function(err) {
		if (err) {
			log.error(err, "Error");
			process.exit(1);
		}
		log.info(nodes_count, "Node count: ");
	});
}

main();
