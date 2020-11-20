// populate graph DB from JSON files
import async = require("async");
import { CrawlQueue } from "../lib/crawl_queue";
import { DbConnector } from "../lib/graphdb_connector";
import fs = require("fs");
import log = require("../lib/log");
import path = require("path");
import priceAsin = require("../lib/price_connector");
import { RateLimiter } from "limiter";

const dbCon = new DbConnector();
const limiter = new RateLimiter(1, "second");

let nodes_count = 0;

function throttledPriceLookup (asin, callback) {
	const workOffline = process.env.OFFLINE;
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
	let newPath;
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
	const callback = moveInputFile.bind(this, cb, filename);
	if (filename.length != 15 || filename.slice(-5) != ".json") {
		return callback(); // primitive filter for interesting files
	}
	const parentAsin = filename.slice(0,-5); // asin.JSON -> asin
	fs.readFile(path.join(CrawlQueue.inputDir, filename), function(err, data) {
		if (err) {
			return callback(err);
		}
		log.info(filename, "read file ");
		let item_list = [];
		try {
			item_list = JSON.parse(data.toString()).Items.Item;
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
			let exitCode = 0;
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
	dbCon.driver.verifyConnectivity().then(()=> {log.info({}, 'ok'); process.exit(); }, (err)=> {log.error({}, err); process.exit(1);});
}

//check();
main();
