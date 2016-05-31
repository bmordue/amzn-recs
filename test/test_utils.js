module.exports = {
	checkOnlyOneNodeMatchesAsin: function(dbConnector, options, callback) {
		if (options.message) {
			console.log(options.message);
		}
		dbConnector.db.cypher({
			query: "MATCH (n {ASIN: {asin}}) RETURN n",
			params: { asin: options.asin}
		}, function(err, result) {
			if (err) {
				return callback(err);
			}
			if (result.length != 1) {
				console.log('result:\n' + JSON.stringify(result, null, 2));
				return callback(new Error('Expected length of result to be 1, got ' + result.length));
			}
			return callback();
		});
	}
};

