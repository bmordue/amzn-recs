// populate graph DB from JSON files
require("dotenv").load({silent: true});
var async = require("async");
var DbConnector = require("../lib/db_connector");
var fs = require("fs");
var log = require("../lib/log");
var path = require("path");
var util = require("util");

var dbCon = new DbConnector();

var nodes_count = 0;

function populate(callback) {
	// expect dir output to be filled with files like "B00TOOSCC6.json"
	fs.readdir("output", function(err, files) {
		if (err) {
			return callback(err);
		}
		log.info(files.length, "files found: ");
		async.each(files, function(filename, file_cb) {
			if (filename.length != 15 || filename.slice(-5) != ".json") {
				return file_cb(); // primitive filter for interesting files
			}
			var parentAsin = filename.slice(0,-5); // asin.JSON -> asin
			fs.readFile(path.join("output", filename), function(err, data) {
				if (err) {
					return file_cb(err);
				}
				log.info(filename, "read file ");
				var item_list = [];
				try {
					item_list = JSON.parse(data).Items.Item;
				} catch (e) {
					return file_cb(e);
				}
				//log.debug(item_list, "item_list: ")
				async.each(item_list, function(item, item_cb) {
					nodes_count++;
					dbCon.createChildBookNode(parentAsin, item, function(err, result) {
						if (err) {
							log.error(item, "error adding node: ");
							return item_cb(err);
						}
						item_cb();
					});
				}, file_cb);
			});
		}, callback);
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
