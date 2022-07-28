// add the first node to the graph
import config = require("../lib/config");
import { MessageQueue } from "../lib/message_queue";


function main() {
  const nodeAsin = process.argv[2] || 'B014V4DXMW'; //starting ASIN
  const job = {
    asin: nodeAsin,
    token: 222222,
    depth: 1
  };

  const queue = new MessageQueue({dbPath: config.get("DB_PATH")});
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
