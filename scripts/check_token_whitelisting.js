// add an API token to the whitelist
var util = require("util");
var Whitelist = require("../lib/whitelist");

function usage() {
    console.log("Usage: node check.js token");
}

var main = function() {
    var token = process.argv[2];
    if (!token) {
        usage();
        process.exit(1);
    }
    console.log(util.format("Checking for token in API whitelist. Token: %s", token));
    var whitelist = new Whitelist();
    whitelist.check(token, function(err, whitelisted) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        console.log(util.format("Token %s whitelisted", whitelisted ? "is" : "is NOT"));
    });
};

main();