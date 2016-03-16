// add the first node to the graph
require("dotenv").load({silent: true});
var aws = require("aws-lib");
var DbConnector = require("../lib/db_connector");

var fail = function() {
	throw new Error("Missing required env var");
};

function main() {
	var rootAsin = process.argv[2] || 'B014V4DXMW'; //starting ASIN

	var keyId = process.env.AMZN_ACCESS_KEY_ID || fail();
	var keySecret = process.env.AMZN_ACCESS_KEY_SECRET || fail();
	var associateTag = process.env.AMZN_ASSOCIATE_TAG || fail();
	
	var dbConnector = new DbConnector();
	
	var prodAdv = aws.createProdAdvClient(keyId, keySecret, associateTag, { host: "webservices.amazon.co.uk"});
	prodAdv.call("ItemLookup", { ItemId: rootAsin, ResponseGroup: "Offers" }, function(err, result) {
		console.log(JSON.stringify(result));
		dbConnector.createBookNode(result.Items.Item, function(err, result) {
			if (err) {
				console.log(err);
			}
			console.log(result);
		});
	});
}

main();
