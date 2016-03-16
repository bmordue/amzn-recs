require("dotenv").load({silent: true});
var async = require("async");
var DbConnector = require("./db_connector");
var fs = require("fs");
var log = require("./log");
var path = require("path");
var util = require("util");

var db = new DbConnector();

function populate(asin, callback) {
	var filename = path.join("output", asin + ".json");
	fs.readFile(filename, function(err, data) {
		if (err) {
			return callback(err);
		}
		var item;
		try {
			item = JSON.parse(data).Items.Item;
			item 
		} catch (e) {
			return callback(e);
		}
		
	});
}

function main() {
	var rootAsin = process.argv[2] || "B014V4DXMW"; //starting ASIN
	db.init(function(err, result) {
		if (err) {
			log.error(err, "Could not init db");
			process.exit(1);
		}		
		populate(rootAsin, function(err, result) {
			if (err) {
				log.error(err, "Error");
			}
			log.info(result, "Result");
		});
	});
}

main();
