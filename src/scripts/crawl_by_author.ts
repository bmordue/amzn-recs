// Crawl based on search for author
// The intent is to populate the DB with all titles by an author
import async = require('async');
import { CrawlQueue } from '../lib/crawl_queue';
import { Item } from '../lib/Item';
import log = require('../lib/log');

function main() {
  const author = process.argv[2]; // eg "Neal Stephenson"
  if (!author) {
    log.error({}, 'Missing required argument: author');
    process.exit(1);
  }
  const depth = process.argv[3] || 1;

  const crawler = new CrawlQueue({ maxCrawlDepth: depth, doPriceLookup: true });

  crawler.resultsForAuthor(author, (err, items: Item[]) => {
    log.info({ author, titles: items.length }, 'Number of titles found');
    async.each(
      items,
      (item, cb) => {
        log.debug(item.ItemAttributes, 'Title by author');
        crawler.db.createBookNode(item, (err) => {
          log.debug({}, 'Called back from createChildBookNode');
          if (err) {
            log.warn({ error: err, data: item }, 'Could not create book node'); // log error, but continue anyway
          }
          crawler.crawl(item.ASIN, 0, cb);
        });
      },
      (err) => {
        if (err) {
          log.error(err, 'Error in crawl_by_author.js#main()');
          log.error(err.stack, 'stack');
          process.exit(1);
        }
        process.exit(0);
      },
    );
  });
}

main();
