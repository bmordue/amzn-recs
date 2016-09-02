require("dotenv").load({silent: true});
var async = require("async");
var log = require("./log");
var sqlite = require("sqlite3").verbose();
var util = require("util");


function MessageQueue(options) {
	this.options = options || {};
	var dbPath = this.options.dbPath || "./temp/db.sqlite";
	try {
		this.db = new sqlite.Database(dbPath);
	} catch (e) {
		console.log(e);
		this.db = null;
	}
}

MessageQueue.prototype.init = function(callback) {
	var db = this.db;
	try {
		db.serialize(function() {
			db.run("CREATE TABLE IF NOT EXISTS lorem (info TEXT)", callback);
		});
	} catch (e) {
		return callback(e);
	}
};

MessageQueue.prototype.close = function(callback) {
	this.db.close(callback);
};

MessageQueue.prototype.add = function(job, callback) {
	var db = this.db;
	var job_id = 0;
	try {
		var stmt = db.prepare("INSERT INTO lorem VALUES (?)");
		stmt.run("Ipsum", function(err, result) {
			log.debug(result);
			stmt.finalize(function(err2) {
				callback(err || err2, job_id);
			});
		});
	} catch (e) {
		return callback(e);
	}
};

MessageQueue.prototype.pop = function(callback) {
	var db = this.db;
	try {
		var stmt = db.prepare("SELECT * FROM lorem LIMIT 1");
		stmt.get(function(err, row) {
			stmt.finalize(function(err2) {
				return callback(err || err2, row);
			});
		});
	} catch (e) {
		return callback(e);
	}
};

module.exports = MessageQueue;
