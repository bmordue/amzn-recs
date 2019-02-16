var assert = require("assert");
var async = require("async");
var fs = require("fs");
var MessageQueue = require("../../lib/message_queue");
var path = require('path');
var util = require("util");

// TODO: make test assertions beyond lack of error
// TODO: waterfalls
// TODO: put queue size verification in some kind of neat wrapper

function dumpDb(db, callback) {
	// TODO: this is out of place; table name is hard-coded, cf CRAWL_TASKS_TABLE_NAME in MessageQueue.js
	var queryStr = "SELECT *, rowid from crawl_tasks";
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

function verifyQueueSize(queue, expected_size, callback) {
	queue.size(function(err, result) {
		if (err) {
			return callback(err);
		}
		try {
			assert.equal(result.total, expected_size);
		} catch (e) {
			console.log(util.format("Expected %s items, found %s", expected_size, result.total));
			return callback(e);
		}
		callback();
	});
}

describe("message queue", function() {
	describe("success responses", function() {

		var queue;
		before(function(done) {
			queue = new MessageQueue();
			queue.init(done);
		});

		before(function() {
			if (process.env.SQLITE_TRACE) {
				queue.db.on('trace', function(query) {
					console.log('SQLITE TRACE: ' + query);
				});
			}
		});

		describe('#init()', function() {
			it("new queue is empty", function(done) {
				verifyQueueSize(queue, 0, done);
			});
		});

		describe("#add()", function() {
			it("add to queue", function(done) {
				var job = {
					asin: 1,
					token: 'test-one'
				};
				queue.size(function(err, result) {
					if (err) {
						return done(err);
					}
					var initial_queue_size = result.total;
					queue.add(job, function(err, job_id) {
						if (err) {
							return done(err);
						}
						try {
							assert(job_id != null);
						} catch (e) {
							return done(e);
						}
						verifyQueueSize(queue, initial_queue_size + 1, done);
					});
				});
			});

			const num_items_to_add = 5;
			it("add " + num_items_to_add + " items to queue", function(done) {
				queue.size(function(err, result) {
					if (err) {
						return done(err);
					}
					var initial_queue_size = result.total;
					async.times(num_items_to_add, function(n, cb) {
						var job = {
							token: "test-two",
							asin: "test-asin-" + n
						};
						queue.add(job, cb);
					}, function(err) {
						if (err) {
							return done(err);
						}
						verifyQueueSize(queue, initial_queue_size + num_items_to_add, done);
					});
				});
			});
		});
		describe("#claim()", function() {
			it("claim a task", function(done) {
				queue.claim(function(err, task) {
					if (err) {
						return done(err);
					}
					//console.log("Claimed a task");
					//console.log(util.inspect(task));
					done();
				});
			});
			it("try to claim from an empty queue");
		});
		describe("#complete()", function() {
			it("mark task complete", function(done) {
				async.waterfall([
					function(cb) {
						queue.add({ token: 'rubbish_token', asin: 'rubbish_ASIN'}, cb);
					},
					function(new_task, cb) {
						dumpDb(queue.db, cb);
					},
					function(all_db_rows, cb) {
						//console.log(util.format("DB dump: %j", all_db_rows));
						cb();
					},
					function(cb) {
						queue.claim(cb);
					},
					function(task, cb) {
						console.log(util.format("Claimed a task: %j", task));
						if (!task) {
							return cb(new Error("Task is null or undefined"));
						}
						queue.complete(task.rowid, cb);
					},
					function(result, cb) {
						console.log(util.format("Completed task; result is %j", result));
						cb();
					}
					,function(cb) { dumpDb(queue.db, cb); }
				], done);
			 });
		});

	});

	describe("error handling", function() {
		describe("#add()", function() {});
		describe("#claim()", function() {});
		describe("#complete()", function() {});
	});

});
