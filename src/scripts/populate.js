// populate graph DB from JSON files
var async = require("async");
var CrawlQueue = require("../lib/crawl_queue");
var DbConnector = require("../lib/graphdb_connector");
var fs = require("fs");
var log = require("../lib/log");
var path = require("path");
var priceAsin = require("../lib/price_connector");
var RateLimiter = require("limiter").RateLimiter;

var dbCon = new DbConnector();
var limiter = new RateLimiter(1, "second");

var nodes_count = 0;

function throttledPriceLookup (asin, callback) {
	var workOffline = process.env.OFFLINE;
	if (workOffline) {
		return callback(null, {});
	}
	limiter.removeTokens(1, function(err) {
		if (err) {
			return callback(err);
		}
		priceAsin.fetch(asin, callback);
	});
}

function processItem(parentAsin, item, callback) {
	nodes_count++;
	log.debug(item.ASIN, "processItem called for ");
	throttledPriceLookup(item.ASIN, function(err, result) {
		if (err) {
			log.error({error: err.message}, "error looking up price for ASIN " + item.ASIN);
		}
		if (result) {
			item.price = result.price;
			item.currency = result.currency;
		}
//		dbCon.createBookNode(item, function(err) {
		dbCon.createChildBookNodeAndRelations(parentAsin, item, function(err) {
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
	log.debug("before fs.rename in populate.moveInputFile()");
	fs.rename(path.join(CrawlQueue.inputDir, filename), newPath, function(renameErr) {
		// if there's a problem moving the file, log it, but don't fail
		if (renameErr) {
			log.error({err: renameErr, file: filename}, "Error while moving input file");
		}
		log.debug("before callback in populate.moveInputFile()");
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
			log.error(filename, 'error parsing json for ');
			return callback(e);
		}
		log.debug(item_list.length, "item_list.length: ");
		async.each(item_list, function(item, each_cb) {
			processItem(parentAsin, item, each_cb);
		}, callback);
//		processItem(parentAsin, item_list[0], cb);
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
			log.warn(err, "Error creating doneDir or errorDir directory")// log but otherwise ignore
		}
		populate(function(err) {
			var exitCode = 0;
			if (err) {
				log.error(err, "Error");
				exitCode = 1;
			}
			log.info(nodes_count, "Node count: ");
			dbCon.close();
			process.exit(exitCode);
		});
	});
}


function check() {
	dbCon.driver.verifyConnectivity().then(()=> {log.info('ok'); process.exit(); }, (err)=> {log.error(err); process.exit(1);});
}

//check();
main();
