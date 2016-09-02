var assert = require("assert");
var needle = require("needle");
var util = require("util");

describe("crawl API", function() {
	var host = "http://localhost:3000";
	var endpoint = "/crawl";
	var uri = host + endpoint;

	var req_options = {
		json: true,
		headers: {
			'X-Api-Token': 'xxxxxx'
		}
	};

	describe("valid requests", function() {
		it("should respond with 202 for valid POST request with depth provided", function(cb) {
			needle.post(host + endpoint, {asin: "xxxxxx", depth: 2}, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 202, util.format("Unexpected HTTP response code for GET %s", uri));
				} catch (e) {
					console.log("Response status code: " + result.statusCode);
					console.log(result.body);
					return cb(e);
				}
				cb();
			});
		});
		it("should respond with 202 for valid POST request if depth is not provided", function(cb) {
			needle.post(host + endpoint, {asin: "xxxxxx"}, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 202, util.format("Unexpected HTTP response code for GET %s", uri));
				} catch (e) {
					console.log("Response status code: " + result.statusCode);
					console.log(result.body);
					return cb(e);
				}
				cb();
			});
		});
		it("should respond with 202 for valid POST request if unrecognised fields are included in request body", function(cb) {
			var data = {
				asin: "xxxxxx",
				unrecognised: "unknown",
				extra: {
					dummy1: "one",
					dummy2: 2
				}
			};
			needle.post(host + endpoint, data, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 202, util.format("Unexpected HTTP response code for GET %s", uri));
				} catch (e) {
					console.log("Response status code: " + result.statusCode);
					console.log(result.body);
					return cb(e);
				}
				cb();
			});
		});

	});


	describe("bad requests", function() {

		it("should respond with 404 if method is GET", function(cb) {
			needle.request("get", host + endpoint, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 404, util.format("Expected HTTP status 400 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 404 if method is PUT", function(cb) {
			needle.request("put", host + endpoint, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 404, util.format("Expected HTTP status 400 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 404 if method is DELETE", function(cb) {
			needle.request("delete", host + endpoint, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 404, util.format("Expected HTTP status 400 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 400 if ASIN is missing and request body is empty", function(cb) {
			needle.post(host + endpoint, {}, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 400, util.format("Expected HTTP status 400 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 400 if ASIN is missing and request body is not empty", function(cb) {
			needle.post(host + endpoint, {depth:2}, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 400, util.format("Expected HTTP status 400 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 401 if token header is missing", function(cb) {
			var bad_headers_options = req_options;
			delete bad_headers_options.headers['X-Api-Token'];

			needle.post(host + endpoint, {asin: "xxxxxx", depth: 2}, bad_headers_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 401, util.format("Expected HTTP status 401 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});
		it("should respond with 400 if content type header is missing", function(cb) {
			var bad_headers_options = req_options;
			delete bad_headers_options.headers['Content-Type'];
			needle.post(host + endpoint, {asin: "xxxxxx", depth: 2}, bad_headers_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 401, util.format("Expected HTTP status 401 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});
		it("should respond with 400 if content type header is not application/json", function(cb) {
			var bad_headers_options = req_options;
			bad_headers_options.headers['Content-Type'] = "text/plain";
			needle.post(host + endpoint, {asin: "xxxxxx", depth: 2}, bad_headers_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 401, util.format("Expected HTTP status 401 for GET %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});
	});
});