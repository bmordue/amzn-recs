// add an API token to the whitelist
var util = require("util");
var Whitelist = require("../lib/whitelist");

function usage() {
    console.log("Usage: node add_to_api_whitelist.js token");
}

var main = function() {
    var token = process.argv[2];
    if (!token) {
        usage();
        process.exit(1);
    }
    console.log(util.format("Adding token to API whitelist. Token: %s", token));
    var whitelist = new Whitelist();
    whitelist.add(token, function(err) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
    });
};

main();