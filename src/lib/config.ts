import fs = require("fs");
import util = require("util");

require('dotenv').config();


// Read in secrets managed by docker swarm
// https://medium.com/lucjuggery/from-env-variables-to-docker-secrets-bc8802cacdfd
const getDockerSecret = function(secret) {
      try {
            // Swarm secret are accessible within tmpfs /run/secrets dir
            return fs.readFileSync(util.format("/run/secrets/%s", secret), "utf8").trim();
      } catch(e) {
            return false;
      }
}

const defaults = {
      DB_PATH: './temp/db.sqlite',
      HTML_DUMP_DIR: 'temp/html/',
      PORT: 3000,
      AMZN_SERVICE_HOST: 'webservices.amazon.co.uk',
      AMZN_ENDPOINT: 'https://www.amazon.co.uk/gp/product/',
      STATSD_HOST: 'localhost',
      AMZN_RECS_LOG_LEVEL: 'DEBUG',
      CRAWL_API_ENDPOINT: 'http://127.0.0.1:3000'
};

export function get(secret, required = false) {
      const secretValue = process.env[secret] || getDockerSecret(secret) || defaults[secret];
      if (required && !secretValue) {
            throw new Error("Missing required env var");
      }
      return secretValue;
}
