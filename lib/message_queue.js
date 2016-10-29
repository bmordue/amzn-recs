require("dotenv").load({silent: true});
var async = require("async");
var log = require("./log");
var sqlite = require("sqlite3").verbose();
var util = require("util");

const CRAWL_TASKS_TABLE_NAME = "crawl_tasks";

MessageQueue.STATUS_WAITING			= 'waiting';
MessageQueue.STATUS_PROCESSING	= 'processing';
MessageQueue.STATUS_DONE				= 'done';

// TODO: make sure no DB context is leaking through callback results!

function dumpDb(db, callback) {
	var queryStr = util.format("SELECT *, rowid from %s", CRAWL_TASKS_TABLE_NAME);
	var stmt = db.prepare(queryStr);
	stmt.all(function(err, rows) {
		if (err) {
			return callback(err);
		}
		stmt.finalize(function(err) {
			callback(err, rows);
		});
	});
}

function MessageQueue(options) {
	this.options = options || {};
	var dbPath = this.options.dbPath || "./temp/db.sqlite";
	try {
		this.db = new sqlite.Database(dbPath);
		this.db.serialize();
	} catch (e) {
		console.log(e);
		this.db = null;
	}
}

MessageQueue.prototype.init = function(callback) {
	var db = this.db;
	try {
		var queryString = util.format("CREATE TABLE IF NOT EXISTS %s (asin TEXT NOT NULL, token TEXT NOT NULL, depth INTEGER, status TEXT)", CRAWL_TASKS_TABLE_NAME);
		db.run(queryString, callback);
	} catch (e) {
		return callback(e);
	}
};

MessageQueue.prototype.close = function(callback) {
	this.db.close(callback);
};

// TODO: also return break-down by statusCode
//callback(err, result) where result = { total:x, done:y, waiting:z, processing:w}
MessageQueue.prototype.size = function(callback) {
	var db = this.db;
	var job_id = 0;
	try {
		var queryString = util.format("SELECT COUNT(*) FROM %s", CRAWL_TASKS_TABLE_NAME);
		var stmt = db.prepare(queryString);
		stmt.get(function(err, result) {
			stmt.finalize(function(err2) {
				callback(err || err2, {total: result["COUNT(*)"]});
			});
		});
	} catch (e) {
		return callback(e);
	}
}

MessageQueue.prototype.add = function(job, callback) {
	var db = this.db;
	var job_id = 0;
	try {
		var queryString = util.format("INSERT INTO %s VALUES (?, ?, ?, ?)", CRAWL_TASKS_TABLE_NAME);
		var stmt = db.prepare(queryString);
		stmt.run([job.asin, job.token, job.depth, MessageQueue.STATUS_WAITING], function(err, result) {
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
		async.waterfall(
			[
				function(cb) {
					selectStmt.get(cb);
				},
				function(result, cb) {
					if (result.rowid) {
						row = result;
						rowId = result.rowid;
						delete row.rowid;
					} else {
						log.warn(result, "Result row for select was empty");
						cb = result;
					}
					selectStmt.finalize(cb);
				},
				function(cb) {
					if (row) {
						return deleteStmt.get([rowId], cb);
					} else {
						log.debug({}, "Result row was empty; nothing to delete from queue");
						return cb();
					}
				},
				function(cb) {
					deleteStmt.finalize(cb);
				}
			],
			function(err, res) {
				log.debug(row, "Call back with result row");
				row = row || {};
				return callback(err, row);
		});
	} catch (e) {
		return callback(e);
	}
};

// claim the item at the top of the queue
// TODO: async.waterfall
// TODO: make finding top of queue and claiming it a single transaction
MessageQueue.prototype.claim = function(callback) {
	var db = this.db;
	var selectQStr = util.format("SELECT *, rowid FROM %s WHERE status = '%s' ORDER BY rowid LIMIT 1",
														CRAWL_TASKS_TABLE_NAME, MessageQueue.STATUS_WAITING);
	log.debug(selectQStr, "selectQStr");
	var selectStmt = db.prepare(selectQStr);
	selectStmt.get(function(err, row) {
		log.debug(row, "Fetched top of queue");
		if (err) {
			return callback(err);
		}
		if (!row) {
			log.warn({}, "Attempting to claim task from an empty queue");
			return callback();
		}
		selectStmt.finalize(function(err) {
			if (err) {
				return callback(err);
			}
			updateStatus(db, row.rowid, MessageQueue.STATUS_PROCESSING, callback);
		});
	});
}

function updateStatus(db, rowid, status, callback) {
	if (!rowid) {
		return callback(new Error("rowid was null or undefined"));
	}
	if (!status) {
		return callback(new Error("status was null or undefined"));
	}
	var selectQStr = util.format("UPDATE OR FAIL %s SET status = '?' WHERE rowid = ?",
															CRAWL_TASKS_TABLE_NAME);
	log.debug(selectQStr, "selectQStr");
	try {
		var selectStmt = db.prepare(selectQStr);
		var responseTask;
		async.waterfall([
			function(cb) {
				selectStmt.get([status, rowid], cb);
			},
			function(result, cb) {
				log.debug(result, "Finished message queue update");
				var responseTask = result;
				selectStmt.finalize(cb);
			},
		], function(err) {
			callback(err, responseTask);
		});
	} catch (e) {
		console.error(e);
		console.log("EXCEPTION WILL ROBINSON");
		callback(e);
	}
}

// mark a claimed task as complete
// TODO: check status before update is MessageQueue.STATUS_PROCESSING
// TODO: record requester; verify same requester is marking the task complete
MessageQueue.prototype.complete = function(rowid, callback) {
	updateStatus(this.db, rowid, MessageQueue.STATUS_DONE, callback);
}

// 'unclaim' a task to return it to the queue (ie processing was not completed)
// TODO: check status before update is MessageQueue.STATUS_PROCESSING
// TODO: record requester; verify same requester is marking the task complete
MessageQueue.prototype.unclaim = function(rowid, callback) {
	updateStatus(this.db, rowid, MessageQueue.STATUS_WAITING, callback);
}

module.exports = MessageQueue;
