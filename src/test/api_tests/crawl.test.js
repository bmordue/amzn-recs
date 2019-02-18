require("dotenv").load({silent: true});
var assert = require("assert");
var needle = require("needle");
var util = require("util");

describe("crawl API", function() {
	var uri = process.env.CRAWL_API_ENDPOINT || "http://localhost:3000/tasks";

	var req_options = {
		json: true,
		headers: {
			'X-Api-Token': '111111'
		}
	};

	describe("valid requests", function() {
		it("should respond with 202 for valid POST request with depth provided", function(cb) {
			needle.post(uri, {asin: "xxxxxx", depth: 2}, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 202, util.format("Unexpected HTTP response code for POST %s", uri));
				} catch (e) {
					console.log("Response status code: " + result.statusCode);
					console.log(result.body);
					return cb(e);
				}
				cb();
			});
		});
		it("should respond with 202 for valid POST request if depth is not provided", function(cb) {
			needle.post(uri, {asin: "xxxxxx"}, req_options, function(err, result) {
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
			needle.post(uri, data, req_options, function(err, result) {
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

		it("should respond with 401 if method is GET", function(cb) {
			needle.request("get", uri, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 401, util.format("Expected HTTP status 401 for GET %s", uri));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 401 if method is PUT", function(cb) {
			needle.request("put", uri, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 401, util.format("Expected HTTP status 401 for PUT %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 401 if method is DELETE", function(cb) {
			needle.request("delete", uri, req_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert(result.statusCode == 401, util.format("Expected HTTP status 401 for DELETE %s; got %s", uri, result.statusCode));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});

		it("should respond with 400 if ASIN is missing and request body is empty", function(cb) {
			needle.post(uri, {}, req_options, function(err, result) {
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
			needle.post(uri, {depth:2}, req_options, function(err, result) {
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
			var bad_options = {
				json: true
			};
			needle.post(uri, {asin: "xxxxxx", depth: 2}, bad_options, function(err, result) {
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
		it("should respond with 403 if token is not in whitelist", function(cb) {
			var bad_options = {
				json: true,
				headers: {
					'X-Api-Token': 'not-whitelisted'
				}
			};
			needle.post(uri, {asin: "xxxxxx", depth: 2}, bad_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 403, util.format("Expected HTTP status 403 for GET %s", uri));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});
		it("should respond with 400 if content type header is missing", function(cb) {
			var bad_options = {
				json: false,
				headers: {
					'X-Api-Token': '111111'
				}
			};
			needle.post(uri, JSON.stringify({asin: "xxxxxx", depth: 2}), bad_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 400, util.format("Expected HTTP status 400 for GET %s", uri));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});
		it("should respond with 400 if content type header is not application/json", function(cb) {
			var bad_options = {
				json: false,
				headers: {
					'Content-Type': "text/plain",
					'X-Api-Token': '111111'
				}
			};
			needle.post(uri, JSON.stringify({asin: "xxxxxx", depth: 2}), bad_options, function(err, result) {
				if (err) {
					return cb(err);
				}
				try {
					assert.equal(result.statusCode, 400, util.format("Expected HTTP status 400 for GET %s", uri));
				} catch (e) {
					return cb(e);
				}
				cb();
			});
		});
	});
});