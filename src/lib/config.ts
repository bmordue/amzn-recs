import fs = require("fs");
import util = require("util");

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

const parameters = {
      DB_PATH: './temp/db.sqlite',
      HTML_DUMP_DIR: 'temp/html/',
      PORT: 3000
};

export function get(secret, required = false) {
      const secretValue = parameters[secret] || process.env[secret] || getDockerSecret(secret);
      if (required && !secretValue) {
            throw new Error("Missing required env var");
      }
      return secretValue;
}
