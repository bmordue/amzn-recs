// add the first node to the graph
require("dotenv").load({silent: true});
var CrawlQueue = require("../lib/crawl_queue");
var MessageQueue = require("../lib/message_queue");

function OLD_main() {
	var nodeAsin = process.argv[2] || 'B014V4DXMW'; //starting ASIN
	var crawler = new CrawlQueue();
	//set up DB constraints
	crawler.db.init(function(err) {
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

function main() {
	var nodeAsin = process.argv[2] || 'B014V4DXMW'; //starting ASIN
	var job = {
		asin: nodeAsin,
		token: 222222,
		depth: 1
	};

	var queue = new MessageQueue({dbPath: './temp/db.sqlite'});
	queue.init(function(err) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
		queue.add(job, function(err) {
			if (err) {
				console.log(err);
				process.exit(1);
			}
		});
	});
}

main();
