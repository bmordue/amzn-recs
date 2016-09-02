var bodyParser   = require('body-parser');
var finalhandler = require('finalhandler');
var http         = require('http');
var MessageQueue = require('../lib/message_queue');
var Router       = require('router');
var url          = require('url');
var util         = require('util');

const PORT = 3000;

var msg_queue = new MessageQueue();
msg_queue.init();

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

router.post('/crawl', function (req, res) {
	var token = req.headers["x-api-token"];
	if (!token) {
		return handleClientError(401, "Missing X-Api-Token header", req, res);
	}
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
		token: token,
		depth: depth
	};

	msg_queue.add(task, function(err, job_id) {
		if (err) {
			console.log(err);
			return handleServerError(503, "Failed to add task to queue", req, res);
		}

		res.statusCode = 202;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		var responseJson = {
			id: job_id
		};
		var responseBody = JSON.stringify(responseJson, null, 4) + '\n';
		res.end(responseBody);
		console.log(util.format("%s %s %s", res.statusCode, req.method, req.url));
	});
});

var server = http.createServer(function(req, res) {
	router(req, res, finalhandler(req, res));
});

server.listen(PORT);
console.log("Server crawl listening on port " + PORT);