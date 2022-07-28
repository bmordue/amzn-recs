import async = require('async');
import util = require('util');
import { CrawlQueue } from '../lib/crawl_queue';
import log = require('../lib/log')

// given two ASINs, start and finish, fill the database with enough nodes to be able to find a path between start and finish

const MAX_ATTEMPTS = 3;

const crawler = new CrawlQueue({ maxCrawlDepth: 1, doPriceLookup: false });

function findPath(start, finish, attempts, crawlList, callback) {
  let newCrawlList = [];
  // must be eachSeries because callback writes to newCrawlList
  async.eachSeries(crawlList, (asin, each_cb) => {
    crawler.crawl(asin, 0, (err, addedNodes) => {
      if (err) { return each_cb(err); }
      newCrawlList = addAsinsToCrawlList(newCrawlList, addedNodes);
      //      newCrawlList = newCrawlList.concat(addedNodes);
      each_cb();
    });
  }, (err) => {
    if (err) { return callback(err); }

    crawler.db.getPath(start, finish, (err, path) => {
      if (err) { return callback(err); }

      if (!path && attempts < MAX_ATTEMPTS) {
        return findPath(start, finish, attempts + 1, newCrawlList, callback);
      }

      if (path) {
        console.log(`Found a path: ${util.inspect(path, { depth: 8, compact: false })}`);
      }

      console.log(`Finished looking for a path after ${attempts} attempts (max ${MAX_ATTEMPTS})`);

      return callback(null, path);
    });
  });
}

function addAsinsToCrawlList(asinList, nodeList) {
  return asinList.concat(nodeList.map(getAsinFromNode));
}

function getAsinFromNode(node) {
  console.log('getAsinFromNode');
  console.log(util.inspect(node));
  const asin = node.ASIN;
  console.log(`asin: ${asin}`);
  return asin;
}

function main() {
  const start = process.argv[2] || 'B07HFC2KQM';
  const finish = process.argv[3] || 'B07DHRMBCJ';
  console.log(`Try to find path from ${start}to ${finish}`);

  const findpath = process.argv[4];

  if (findpath) {
    console.log(`Find path options is ${findpath}`);
    findPath(start, finish, 1, [start, finish], (err) => {
      if (err) { console.log(err); process.exit(1); }
      console.log('Finished finding path without error');
      process.exit();
    });
  } else {
    crawler.db.getPath(start, finish, (err, path) => {
      console.log(JSON.stringify(path, null, 4));
      process.exit();
    });
  }
}

main();
