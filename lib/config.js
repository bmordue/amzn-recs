const fs = require("fs"),
      util = require("util");

// Read in secrets managed by docker swarm
// https://medium.com/lucjuggery/from-env-variables-to-docker-secrets-bc8802cacdfd
var getDockerSecret = function(secret) {
      try {
            // Swarm secret are accessible within tmpfs /run/secrets dir
            return fs.readFileSync(util.format(“/run/secrets/%s”, secret), "utf8").trim();
      } catch(e) {
            return false;
      }
}

module.exports = {
  // Get a secret from its name
      get(secret, required = false) {
            secretValue = process.env[secret] || getDockerSecret(secret)
            if (required && !secretValue) {
            	throw new Error("Missing required env var");
            }
            return secretValue;
      }
};
