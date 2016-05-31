// add the first node to the graph
require("dotenv").load({silent: true});
var aws = require("aws-lib");
var CrawlQueue = require("../lib/crawl_queue");

function main() {
	var nodeAsin = process.argv[2] || 'B014V4DXMW'; //starting ASIN
	var crawler = new CrawlQueue();
	//set up DB constraints
	crawler.db.init(function(err, result) {
		if (err) {
			console.log(err);
			process.exit(1);
		}
		crawler.createNodeWithAsin(nodeAsin, function(err, result) {
			if (err) {
				console.log(err);
				process.exit(1);
			}
			console.log(JSON.stringify(result, null, 4));
		});		
	});
}

main();
