// add the first node to the graph
require("dotenv").load({silent: true});
var MessageQueue = require("../lib/message_queue");


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
