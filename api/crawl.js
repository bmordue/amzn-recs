var bodyParser   = require('body-parser');
var finalhandler = require('finalhandler');
var http         = require('http');
var log          = require('../lib/log');
var MessageQueue = require('../lib/message_queue');
var Router       = require('router');
var url          = require('url');
var util         = require('util');
var Whitelist    = require('../lib/whitelist');

const PORT = 3000;

var msg_queue = new MessageQueue();
var whitelist = new Whitelist();
msg_queue.init();

//TODO: request IDs

function handleError(side, code, msg, req, res) {
	console.log(util.format("%s %s %s - %s ERROR: %s", code, req.method, req.url, side, msg));
	res.statusCode = code;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify({error: msg}));
}

var handleClientError = handleError.bind(this, "CLIENT");
var handleServerError = handleError.bind(this, "SERVER");

function handleBadRequest(errorMsg, req, res) {
	handleClientError(400, errorMsg, req, res);
}

var router = Router();
router.use(bodyParser.json());

// "auth middleware"
router.use(function (req, res, next) {
	var token = req.headers["x-api-token"];
	if (!token) {
		return handleClientError(401, "Missing X-Api-Token header", req, res);
	}

	whitelist.check(token, function(err, whitelisted) {
		if (err) {
			console.log(err);
			return handleServerError(503, "Failed to check token whitelisting", req, res);
		}
		if (!whitelisted) {
			return handleClientError(403, "Token has not been whitelisted: " + token, req, res);
		}
		req.token = token;
		next();
	});
});

// POST /tasks
// add a new crawl task to the queue
router.post('/tasks', function (req, res) {
	if (!req.headers["content-type"]) {
		return handleBadRequest("Content type header is missing", req, res);
	}
	if (req.headers["content-type"].indexOf("application/json") == -1) {
		return handleBadRequest("Request content type must be application/json", req, res);
	}
	if (!req.body) {
		return handleBadRequest("Request body must not be empty", req, res);
	}

	var asin = req.body.asin;
	if (!asin) {
		return handleBadRequest("No ASIN in query string", req, res);
	}

	var depth = req.body.depth;	//undefined is OK

	var task = {
		asin: asin,
		token: req.token,
		depth: depth,
		status: msg_queue.STATUS_WAITING
	};

	msg_queue.add(task, function(err, job_id) {
		if (err) {
			var errMsg = 'Failed to ask task to queue';
			log.error(err, errMsg);
			return handleServerError(503, errMsg, req, res);
		}

		res.statusCode = 202;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		var responseJson = {
			id: job_id
		};
		var responseBody = JSON.stringify(responseJson, null, 4) + '\n';
		res.end(responseBody);
		log.info({status: res.statusCode, method: req.method, url: req.url}, 'Finished processing request');
	});
});

// POST tasks/take
// request a task from the queue
router.post('tasks/take', function(req,res) {
	msg_queue.claim(function(err, task) {
		if (err) {
			var errMsg = 'Failed to get a task from the queue';
			log.error(err, errMsg);
			return handleServerError(503, errMsg, req, res);
		}

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		var responseJson = {
			asin: task.asin,
			depth: task.depth
		}
		var responseBody = JSON.stringify(responseJson, null, 4) + '\n';
		res.end(responseBody);
		log.info({status: res.statusCode, method: req.method, url: req.url}, 'Finished processing request');
	});
});

// PUT tasks/{id}
// update status of a task
// TODO: refactor to reduce duplication
router.put('tasks', function(req, res) {
	if (!req.headers["content-type"]) {
		return handleBadRequest("Content type header is missing", req, res);
	}
	if (req.headers["content-type"].indexOf("application/json") == -1) {
		return handleBadRequest("Request content type must be application/json", req, res);
	}
	if (!req.body) {
		return handleBadRequest("Request body must not be empty", req, res);
	}

	var taskId = req.body.id;
	if (!taskId) {
		return handleBadRequest("Request is missing task id", req, res);
	}

	var taskStatus = req.body.status;
	if (!taskStatus) {
		return handleBadRequest("Request is missing task status", req, res);
	}

	// switch (taskStatus) {
	// 	case MessageQueue.STATUS_DONE:
	// 		return msg_queue.complete(taskId, callback);
	// 	case MessageQueue.STATUS_WAITING:
	// 		log.warn(taskId, "Request to set task status back to WAITING");
	// 		return msg_queue.unclaim(taskId, callback);
	// }
	throw new Error("Not finished this bit!");

});

// catch all, must be the last route
router.use(function(req, res, next) {
	if (req.method != "POST") {
		return handleClientError(405, "Method not supported: " + req.method, req, res);
	}
	// next();
});


var server = http.createServer(function(req, res) {
	router(req, res, finalhandler(req, res));
});

server.listen(PORT);
log.info({}, "Crawl API listening on port " + PORT);
