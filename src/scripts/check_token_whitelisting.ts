// add an API token to the whitelist
import util = require('util');
import { Whitelist } from '../lib/whitelist';

function usage() {
  console.log('Usage: node check.js token');
}

const main = function () {
  const token = process.argv[2];
  if (!token) {
    usage();
    process.exit(1);
  }
  console.log(util.format('Checking for token in API whitelist. Token: %s', token));
  const whitelist = new Whitelist();
  whitelist.check(token, (err, whitelisted) => {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    console.log(util.format('Token %s whitelisted', whitelisted ? 'is' : 'is NOT'));
  });
};

main();
