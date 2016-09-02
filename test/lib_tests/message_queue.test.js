var assert = require("assert");
var fs = require("fs");
var MessageQueue = require("../../lib/message_queue");
var util = require("util");

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
	
	it("should add to queue", function(done) {
		var job = {};
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

	it("should pop from queue", function(done) {
		queue.pop(function(err, result) {
			console.log(util.format("Result is %j", result));
			done(err);
		});
	});
	
	after(function(done) {
		queue.close(done);
	});

});