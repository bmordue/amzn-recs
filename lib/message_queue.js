require("dotenv").load({silent: true});
var async = require("async");
var log = require("./log");
var sqlite = require("sqlite3").verbose();
var util = require("util");

const CRAWL_TASKS_TABLE_NAME = "crawl_tasks";

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
			var queryString = util.format("CREATE TABLE IF NOT EXISTS %s (asin TEXT NOT NULL, token TEXT NOT NULL, depth INTEGER)", CRAWL_TASKS_TABLE_NAME);
			db.run(queryString, callback);
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
		var queryString = util.format("INSERT INTO %s VALUES (?, ?, ?)", CRAWL_TASKS_TABLE_NAME);
		var stmt = db.prepare(queryString);
		stmt.run([job.asin, job.token, job.depth], function(err, result) {
			stmt.finalize(function(err2) {
				callback(err || err2, job_id);
			});
		});
	} catch (e) {
		return callback(e);
	}
};

MessageQueue.prototype.shift = function(callback) {
	var db = this.db;
	try {
		var selectQStr = util.format("SELECT *, rowid FROM %s ORDER BY rowid LIMIT 1", CRAWL_TASKS_TABLE_NAME);
		var deleteQStr = util.format("DELETE FROM %s WHERE rowid = ?", CRAWL_TASKS_TABLE_NAME);
		var selectStmt = db.prepare(selectQStr);
		var deleteStmt = db.prepare(deleteQStr);
		var row;
		db.serialize(function() {
			async.waterfall(
				[
					function(cb) {
						selectStmt.get(cb);
					},
					function(result, cb) {
						row = result;
						rowId = result.rowid;
						delete row.rowid;
						selectStmt.finalize(cb);
					},
					function(cb) {
						deleteStmt.get([rowId], cb);
					},
					function(cb) {
						deleteStmt.finalize(cb);
					}
				],
				function(err, res) {
					return callback(err, row);
			});
		});
	} catch (e) {
		return callback(e);
	}
};

module.exports = MessageQueue;
