import StatsD = require('node-statsd');
import util = require('util');
import log = require('./log');
import config = require('./config');

const statsd = new StatsD({
  prefix: 'amzn-recs.message_queue.',
  host: config.get('STATSD_HOST'),
});

export class MessageQueue {
  static STATUS_WAITING = 'waiting';

  static STATUS_PROCESSING = 'processing';

  static STATUS_DONE = 'done';

  options;

  mq;

  constructor(options = {}) {
    this.options = options || {};
    this.mq = [];
  }

  init = function (callback) {
    callback();
  };

  close = function (callback) {
    callback();
  };

  // TODO: also return break-down by statusCode
  // callback(err, result) where result = { total:x, done:y, waiting:z, processing:w}
  size = function (callback) {
    callback(null, { total: this.mq.length });
  };

  add = function (job, callback) {
    statsd.increment('add');
    job.status = MessageQueue.STATUS_WAITING;
    const len = this.mq.push(job);
    const row = len - 1;
    this.mq[row].rowid = row;
    callback(null, row);
  };

  // claim the item at the top of the queue
  // callback(err, task)
  claim = function (callback) {
    statsd.increment('claim');
    const i = this.mq.findIndex((el) => el.status === MessageQueue.STATUS_WAITING);
    if (typeof (i) === 'undefined') {
      return callback(new Error('Could not take a task from queue'));
    }
    if (!this.mq[i]) {
      return callback(new Error(util.format('Could not find task with id %s', i)));
    }
    this.mq[i].status = MessageQueue.STATUS_PROCESSING;
    callback(null, this.mq[i]);
  };

  // mark a claimed task as complete
  // TODO: check status before update is MessageQueue.STATUS_PROCESSING
  // TODO: record requester; verify same requester is marking the task complete
  complete = function (rowid, callback) {
    statsd.increment('complete');
    if (rowid >= this.mq.length) {
      return callback(new Error('Index out of bounds'));
    }
    this.mq[rowid].status = MessageQueue.STATUS_DONE;
    callback(null, this.mq[rowid]);
  };

  // 'unclaim' a task to return it to the queue (ie processing was not completed)
  // TODO: check status before update is MessageQueue.STATUS_PROCESSING
  // TODO: record requester; verify same requester is marking the task complete
  unclaim = function (rowid, callback) {
    statsd.increment('unclaim');
    if (!rowid) {
      log.warn({}, 'Called MessageQueue.unclaim without providing a task id');
      return callback();
    }
    if (rowid >= this.mq.length) {
      return callback(new Error('Index out of bounds'));
    }
    this.mq[rowid].status = MessageQueue.STATUS_WAITING;
    callback(null, this.mq[rowid]);
  };
}
