// add an API token to the whitelist
import util = require("util");
import { Whitelist } from "../lib/whitelist";

function usage() {
    console.log("Usage: node add_to_api_whitelist.js token");
}

const main = function() {
    const token = process.argv[2];
    if (!token) {
        usage();
        process.exit(1);
    }
    console.log(util.format("Adding token to API whitelist. Token: %s", token));
    const whitelist = new Whitelist();
    whitelist.add(token, function(err) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
    });
};

main();