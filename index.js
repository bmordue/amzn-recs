require("dotenv").load( {silent: true});
var aws = require("aws-lib");

var fail = function() {
	console.log("FATAL: Missing required env var");
	process.exit(1);
};

var main = function() {
	var keyId = process.env.AMZN_ACCESS_KEY_ID || fail();
	var keySecret = process.env.AMZN_ACCESS_KEY_SECRET || fail();
	var associateTag = process.env.AMZN_ASSOCIATE_TAG || fail();

	prodAdv = aws.createProdAdvClient(keyId, keySecret, associateTag);

	prodAdv.call("ItemSearch", {SearchIndex: "Books", Keywords: "Javascript"}, function(err, result) {
		if (err) {
			console.log(err);
		}
		console.log(JSON.stringify(result));
		process.exit(0);
	})	
};

main();