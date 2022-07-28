import bodyParser = require('body-parser');
import finalhandler = require('finalhandler');
import http = require('http');
import Router = require('router');
import StatsD = require('node-statsd');
import util = require('util');
import { MessageQueue } from '../lib/message_queue';
import log = require('../lib/log');
import config = require('../lib/config');
import { Whitelist } from '../lib/whitelist';

const PORT = config.get('PORT') || 3000;

const statsd = new StatsD();

const msg_queue = new MessageQueue();
const whitelist = new Whitelist();
// msg_queue.init();

// TODO: request IDs

function handleError(side, code, msg, req, res) {
  statsd.increment('error_responses');
  log.error({
    code, method: req.method, url: req.url, side,
  }, msg);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: msg }));
}

const handleClientError = handleError.bind(this, 'CLIENT');
const handleServerError = handleError.bind(this, 'SERVER');

function handleBadRequest(errorMsg, req, res) {
  statsd.increment('bad_requests');
  handleClientError(400, errorMsg, req, res);
}

function handleSuccess(responseJson, req, res) {
  statsd.increment('success_responses');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const responseBody = `${JSON.stringify(responseJson, null, 4)}\n`;
  res.end(responseBody);
  log.info({ status: res.statusCode, method: req.method, url: req.url }, 'Finished processing request');
}

const router = Router();
router.use(bodyParser.json());

// "auth middleware"
router.use((req, res, next) => {
  const token = req.headers['x-api-token'];
  if (!token) {
    return handleClientError(401, 'Missing X-Api-Token header', req, res);
  }

  whitelist.check(token, (err, whitelisted) => {
    if (err) {
      return handleServerError(503, 'Failed to check token whitelisting', req, res);
    }
    if (!whitelisted) {
      return handleClientError(403, `Token has not been whitelisted: ${token}`, req, res);
    }
    req.token = token;
    next();
  });
});

// POST /tasks
// add a new crawl task to the queue
router.post('/tasks', (req, res) => {
  if (!req.headers['content-type']) {
    return handleBadRequest('Content type header is missing', req, res);
  }
  if (req.headers['content-type'].indexOf('application/json') == -1) {
    return handleBadRequest('Request content type must be application/json', req, res);
  }
  if (!req.body) {
    return handleBadRequest('Request body must not be empty', req, res);
  }

  const { asin } = req.body;
  if (!asin) {
    return handleBadRequest('No ASIN in query string', req, res);
  }

  const { depth } = req.body; // undefined is OK

  const task = {
    asin,
    token: req.token,
    depth,
    status: MessageQueue.STATUS_WAITING,
  };

  msg_queue.add(task, (err, job_id) => {
    if (err) {
      const errMsg = 'Failed to ask task to queue';
      log.error(err, errMsg);
      return handleServerError(503, errMsg, req, res);
    }

    res.statusCode = 202;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const responseJson = {
      id: job_id,
    };
    const responseBody = `${JSON.stringify(responseJson, null, 4)}\n`;
    res.end(responseBody);
    log.debug({ task }, 'Finished processing request');
    log.info({ status: res.statusCode, method: req.method, url: req.url }, 'Sent response');
  });
});

// POST tasks/take
// request a task from the queue
router.post('tasks/take', (req, res) => {
  msg_queue.claim((err, task) => {
    if (err) {
      const errMsg = 'Failed to get a task from the queue';
      log.error(err, errMsg);
      return handleServerError(503, errMsg, req, res);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const responseJson = {
      asin: task.asin,
      depth: task.depth,
    };
    const responseBody = `${JSON.stringify(responseJson, null, 4)}\n`;
    res.end(responseBody);
    log.info({ status: res.statusCode, method: req.method, url: req.url }, 'Finished processing request');
  });
});

// PUT tasks/{id}
// update status of a task
// TODO: refactor to reduce duplication
router.put('tasks', (req, res) => {
  if (!req.headers['content-type']) {
    return handleBadRequest('Content type header is missing', req, res);
  }
  if (req.headers['content-type'].indexOf('application/json') == -1) {
    return handleBadRequest('Request content type must be application/json', req, res);
  }
  if (!req.body) {
    return handleBadRequest('Request body must not be empty', req, res);
  }

  const taskId = req.body.id;
  if (!taskId) {
    return handleBadRequest('Request is missing task id', req, res);
  }

  const taskStatus = req.body.status;
  if (!taskStatus) {
    return handleBadRequest('Request is missing task status', req, res);
  }

  let updateTaskFn;
  switch (taskStatus) {
    case MessageQueue.STATUS_DONE:
      updateTaskFn = msg_queue.complete;
      break;
    case MessageQueue.STATUS_WAITING:
      updateTaskFn = msg_queue.unclaim;
      log.warn(taskId, 'Request to set task status back to WAITING');
      break;
    default:
      updateTaskFn = function (_, cb) { cb(new Error('Unrecognised status')); };
      handleBadRequest(util.format('Unrecognised status: %s', taskStatus), req, res);
  }
  updateTaskFn(taskId, (err) => {
    if (err) {
      const errMsg = 'Unable to update status in queue';
      log.error(err, errMsg);
      handleServerError(503, errMsg, req, res);
    } else {
      handleSuccess({}, req, res); // TODO: echo updated task in response body
    }
  });
});

// catch all, must be the last layer
router.use((req, res) => {
  if (req.method != 'POST') {
    return handleClientError(405, `Method not supported: ${req.method}`, req, res);
  }
});

const server = http.createServer((req, res) => {
  router(req, res, finalhandler(req, res));
});

server.listen(PORT);
log.info({}, `Crawl API listening on port ${PORT}`);
