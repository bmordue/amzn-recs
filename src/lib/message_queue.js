require("dotenv").load({silent: true});
var async = require("async");
var log = require("./log");
var StatsD = require('node-statsd');
var sqlite = require("sqlite3").verbose();
var util = require("util");

const CRAWL_TASKS_TABLE_NAME = "crawl_tasks";

var statsd = new StatsD();

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
	var dbPath = this.options.dbPath || ":memory:";
	try {
		this.db = new sqlite.Database(dbPath);
		this.db.serialize();
	} catch (e) {
		log.error(e, "Could not connect to database");
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
};

MessageQueue.prototype.add = function(job, callback) {
	var db = this.db;
	statsd.increment('add');
	try {
		var queryString = util.format("INSERT INTO %s VALUES (?, ?, ?, ?)", CRAWL_TASKS_TABLE_NAME);
		var stmt = db.prepare(queryString);
		stmt.get([job.asin, job.token, job.depth, MessageQueue.STATUS_WAITING], function(err, result) {
			stmt.finalize(function(err2) {
				if (!result) {
					result = { rowid: -1};
				}
				callback(err || err2, result.rowid);
			});
		});
	} catch (e) {
		return callback(e);
	}
};

// claim the item at the top of the queue
// callback(err, task)
MessageQueue.prototype.claim = function(callback) {
	var db = this.db;
	statsd.increment('claim');

	var selectQStr = util.format("SELECT *, rowid FROM %s WHERE status = '%s' ORDER BY rowid LIMIT 1",
														CRAWL_TASKS_TABLE_NAME, MessageQueue.STATUS_WAITING);
	log.debug(selectQStr, "selectQStr");
	var selectStmt = db.prepare(selectQStr);
	var row;
	var task;

	async.waterfall([
		function(cb) {
			beginTransaction(db, cb);
		},
		function(cb) {
			selectStmt.get(cb);
		},
		function(result, cb) {
			log.debug(result, "Fetched top of queue");
			if (!result) {
				return cb(new Error("Could not claim a task from queue"));
			}
			row = result;
			selectStmt.finalize(cb);
		},
		function(cb) {
			updateStatus(db, row.rowid, MessageQueue.STATUS_PROCESSING, cb);
		},
		function(result, cb) {
			task = result;
			cb();
		}
	], function(err) {
		if (err) {
			return rollback(db, err, callback);
		}
		endTransaction(db, function(err) {
			callback(err, task);
		});
	});
};

//callback(err)
function beginTransaction(db, callback) {
	db.run("BEGIN", callback);
}

//callback(err)
function endTransaction(db, callback) {
	db.run("END", callback);
}

//callback(err)
function rollback(db, err, callback) {
	statsd.increment('rollback');
	log.error(err, "Rolling back transaction");
	db.run("ROLLBACK", function() { callback(err) });
}

function updateStatus(db, rowid, status, callback) {
	statsd.increment('update_status');
	if (!rowid) {
		return callback(new Error("rowid was null or undefined"));
	}
	if (!status) {
		return callback(new Error("status was null or undefined"));
	}
	var selectQStr = util.format("UPDATE OR FAIL %s SET status = ? WHERE rowid = ?", CRAWL_TASKS_TABLE_NAME);
	var mirrorQStr = util.format("SELECT *, rowid FROM %s WHERE rowid = ?", CRAWL_TASKS_TABLE_NAME);

	log.debug(selectQStr, "selectQStr");
	var selectStmt = db.prepare(selectQStr);
	var mirrorStmt = db.prepare(mirrorQStr);
	var responseTask;
	async.waterfall([
		function(cb) {
			log.debug({query: selectQStr, status: status, rowid: rowid}, "Execute selectStmt");
			selectStmt.get([status, rowid], cb);
		},
		function(cb) {
			log.debug({}, "Finished message queue update");
			selectStmt.finalize(cb);
		},
		function(cb) {
			log.debug({query: mirrorQStr, row: rowid}, "Execute mirrorStmt");
			mirrorStmt.get([rowid], cb);
		},
		function(row, cb) {
			responseTask = row;
			mirrorStmt.finalize(cb);
		}
	], function(err) {
		if (err) {
			log.error(err, "Error in updateStatus()");
			err = new Error("Error in updateStatus");
		} else {
			log.debug(responseTask, "Callback with responseTask");
		}
		callback(err, responseTask);
	});
}

// mark a claimed task as complete
// TODO: check status before update is MessageQueue.STATUS_PROCESSING
// TODO: record requester; verify same requester is marking the task complete
MessageQueue.prototype.complete = function(rowid, callback) {
	statsd.increment('complete');
	updateStatus(this.db, rowid, MessageQueue.STATUS_DONE, callback);
};

// 'unclaim' a task to return it to the queue (ie processing was not completed)
// TODO: check status before update is MessageQueue.STATUS_PROCESSING
// TODO: record requester; verify same requester is marking the task complete
MessageQueue.prototype.unclaim = function(rowid, callback) {
	statsd.increment('unclaim');
	if (!rowid) {
		log.warn({}, "Called MessageQueue.unclaim without providing a task id");
		return callback();
	}
	updateStatus(this.db, rowid, MessageQueue.STATUS_WAITING, callback);
};

module.exports = MessageQueue;
