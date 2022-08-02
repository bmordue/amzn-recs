import assert = require('assert');
import async = require('async');
import util = require('util');
import { MessageQueue } from '../../lib/message_queue';

// TODO: make test assertions beyond lack of error
// TODO: waterfalls
// TODO: put queue size verification in some kind of neat wrapper

function dumpDb(db, callback) {
  return callback(null, []);
  // TODO: this is out of place; table name is hard-coded, cf CRAWL_TASKS_TABLE_NAME in MessageQueue.js
  // const queryStr = 'SELECT *, rowid from crawl_tasks';
  // const stmt = db.prepare(queryStr);
  // stmt.all((err, rows) => {
  //   if (err) {
  //     return callback(err);
  //   }
  //   stmt.finalize((err) => {
  //     callback(err, rows);
  //   });
  // });
}

function verifyQueueSize(queue, expected_size, callback) {
  queue.size((err, result) => {
    if (err) {
      return callback(err);
    }
    try {
      assert.equal(result.total, expected_size);
    } catch (e) {
      console.log(util.format('Expected %s items, found %s', expected_size, result.total));
      return callback(e);
    }
    callback();
  });
}

describe('message queue', () => {
  describe('success responses', () => {
    let queue;
    before((done) => {
      queue = new MessageQueue();
      queue.init(done);
    });

    before(() => {
      if (process.env.SQLITE_TRACE) {
        queue.db.on('trace', (query) => {
          console.log(`SQLITE TRACE: ${query}`);
        });
      }
    });

    describe('#init()', () => {
      it('new queue is empty', (done) => {
        verifyQueueSize(queue, 0, done);
      });
    });

    describe('#add()', () => {
      it('add to queue', (done) => {
        const job = {
          asin: 1,
          token: 'test-one',
        };
        queue.size((err, result) => {
          if (err) {
            return done(err);
          }
          const initial_queue_size = result.total;
          queue.add(job, (err, job_id) => {
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
      it(`add ${num_items_to_add} items to queue`, (done) => {
        queue.size((err, result) => {
          if (err) {
            return done(err);
          }
          const initial_queue_size = result.total;
          async.times(num_items_to_add, (n, cb) => {
            const job = {
              token: 'test-two',
              asin: `test-asin-${n}`,
            };
            queue.add(job, cb);
          }, (err) => {
            if (err) {
              return done(err);
            }
            verifyQueueSize(queue, initial_queue_size + num_items_to_add, done);
          });
        });
      });
    });
    describe('#claim()', () => {
      it('claim a task', (done) => {
        queue.claim((err) => {
          if (err) {
            return done(err);
          }
          // console.log("Claimed a task");
          // console.log(util.inspect(task));
          done();
        });
      });
      it('try to claim from an empty queue');
    });
    describe('#complete()', () => {
      it('mark task complete', (done) => {
        async.waterfall([
          function (cb) {
            queue.add({ token: 'rubbish_token', asin: 'rubbish_ASIN' }, cb);
          },
          function (new_task, cb) {
            dumpDb(queue.db, cb);
          },
          function (all_db_rows, cb) {
            // console.log(util.format("DB dump: %j", all_db_rows));
            cb();
          },
          function (cb) {
            queue.claim(cb);
          },
          function (task, cb) {
            console.log(util.format('Claimed a task: %j', task));
            if (!task) {
              return cb(new Error('Task is null or undefined'));
            }
            queue.complete(task.rowid, cb);
          },
          function (result, cb) {
            console.log(util.format('Completed task; result is %j', result));
            cb();
          },
        ], done);
      });
    });
  });

  describe('error handling', () => {
    describe('#add()', () => {});
    describe('#claim()', () => {});
    describe('#complete()', () => {});
  });
});
