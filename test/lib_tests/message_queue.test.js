var assert = require("assert");
var async = require("async");
var fs = require("fs");
var MessageQueue = require("../../lib/message_queue");
var util = require("util");

// TODO: make test assertions beyond lack of error

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

describe("message queue", function() {
	var testDbPath = "./temp/testDb.sqlite";
	var queue;
	before(function(done) {
		fs.unlink(testDbPath, function(err) {
			if (err && err.code != 'ENOENT') {
				return done(err);
			}
			queue = new MessageQueue({dbPath: testDbPath});
			queue.init(done);
		});
	});

	before(function() {
		if (process.env.SQLITE_TRACE) {
			queue.db.on('trace', function(query) {
				console.log('SQLITE TRACE: ' + query);
			});
		}
	});

	it("should return empty task object if shifting from empty queue", function(done) {
		queue.shift(function(err, result) {
			if (err) {
				return done(err);
			}
			try {
				assert(!Object.keys(result).length); // result is {}
			} catch (e) {
				return done(e);
			}
			done();
		});
	});

	it("should add to queue", function(done) {
		var job = {
			asin: 1,
			token: 'test-one'
		};
		queue.add(job, function(err, job_id) {
			if (err) {
				return done(err);
			}
			try {
				assert(job_id != null);
			} catch (e) {
				return done(e);
			}
			done();
		});
	});

	it("should add several items to queue", function(done) {
		async.times(5, function(n, cb) {
			var job = {
				token: "test-two",
				asin: "test-asin-" + n
			};
			queue.add(job, cb);
		}, done);
	});

	it("should shift first item from queue", function(done) {
		queue.shift(done);
	});

	it("should shift several items from queue", function(done) {
		async.timesSeries(3, function(n, cb) {
			queue.shift(function(err, result) {
				cb(err);
			});
		}, done);
	});

	after(function(done) {
		queue.close(done);
	});

});
