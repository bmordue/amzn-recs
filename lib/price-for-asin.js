var log = require("./log");
var needle = require("needle");

module.exports = {
	fetch: function(asin, callback) {
		var api_endpoint = "http://crissic.benmordue.co.uk:3000/price";
		var reqUrl = api_endpoint + "?asin=" + asin;
		var options = {};
		// options.proxy = 'http://localhost:8888';
		
		needle.get(reqUrl, options, function(err, result) {
			if (err) {
				log.error({url: reqUrl, error: err}, "Error in price-for-asin.fetch()");
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
