var needle = require("needle");

module.exports = {
	fetch: function(asin, callback) {
		var api_endpoint = "http://crissic.benmordue.co.uk:3000/price";
		var reqUrl = api_endpoint + "?asin=" + asin;
		needle.get(reqUrl, function(err, result) {
			if (err) {
				console.log(reqUrl);
				console.log(err);
				return callback(err);
			}
			if (result.responseCode != 200) {
				return callback(new Error("Expected HTTP 200; got " + result.responseCode));
			}
			if (!result.body) {
				return callback(new Error("No response body"));
			}
			callback(null, result.body);
		});
	}
};