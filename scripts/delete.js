// add the first node to the graph
require("dotenv").load({silent: true});
var aws = require("aws-lib");
var DbConnector = require("../lib/db_connector");

var fail = function() {
	throw new Error("Missing required env var");
};

function main() {
	var rootAsin = process.argv[2] || 'B014V4DXMW'; //starting ASIN
	var dbConnector = new DbConnector();
	dbConnector.deleteBookNode(rootAsin, function(err, result) {
		if (err) {
			console.log(err);
		}
		console.log(result);
	});
}

main();
