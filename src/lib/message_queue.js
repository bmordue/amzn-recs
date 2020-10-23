var async = require("async");
var log = require("./log");
var StatsD = require('node-statsd');
var util = require("util");

var statsd = new StatsD({
                        prefix: 'amzn-recs.message_queue.',
                        host: process.env.STATSD_HOST ? process.env.STATSD_HOST : 'localhost'
                });

MessageQueue.STATUS_WAITING			= 'waiting';
MessageQueue.STATUS_PROCESSING	= 'processing';
MessageQueue.STATUS_DONE				= 'done';


function MessageQueue(options) {
	this.options = options || {};
	this.mq = [];
}

MessageQueue.prototype.init = function(callback) {
	callback();
};

MessageQueue.prototype.close = function(callback) {
	callback();
};

// TODO: also return break-down by statusCode
//callback(err, result) where result = { total:x, done:y, waiting:z, processing:w}
MessageQueue.prototype.size = function(callback) {
	callback(null, this.mq.length);
};

MessageQueue.prototype.add = function(job, callback) {
	statsd.increment('add');
	job.status = MessageQueue.STATUS_WAITING;
	const len = this.mq.push(job);
	callback(null, len - 1);
};

// claim the item at the top of the queue
// callback(err, task)
MessageQueue.prototype.claim = function(callback) {
	statsd.increment('claim');
	const i = this.mq.find((el) => el.status === MessageQueue.STATUS_WAITING);
	if (!i) {
		return callback(new Error("Could not take a task from queue"));
	}
	this.mq[i].status = MessageQueue.STATUS_PROCESSING;
	callback(null, this.mq[i]);
};

//callback(err)
function beginTransaction(db, callback) {
	callback();
}

//callback(err)
function endTransaction(db, callback) {
	callback();
}


// mark a claimed task as complete
// TODO: check status before update is MessageQueue.STATUS_PROCESSING
// TODO: record requester; verify same requester is marking the task complete
MessageQueue.prototype.complete = function(rowid, callback) {
	statsd.increment('complete');
	if (rowid >= this.mq.length) {
		return callback(new Error("Index out of bounds"));
	}
	this.mq[rowid].status = MessageQueue.STATUS_DONE;
	callback();
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
	if (rowid >= this.mq.length) {
		return callback(new Error("Index out of bounds"));
	}
	this.mq[rowid].status = MessageQueue.STATUS_WAITING;
	callback(null, this.mq[rowid]);
};

module.exports = MessageQueue;
