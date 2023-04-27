let http = require('http');

module.exports = {
  init,
  readCredentials
}

function init() {
  return function () {
    return {
      call(options, callback) {
        let version = options.version || 'latest';
        let endpoint = options.endpoint || '';
        let url = 'http://169.254.169.254/' + version + '/meta-data/' + endpoint;

        http.get(url, function(res) {
          let string = '';
          res.setEncoding('utf8');
          res.on('data', function(chunk) {
            string += chunk;
          });
          res.on('end', function() {
            if (res.statusCode == 200) {
              return callback(null, string);
            } else {
              return callback(new Error('HTTP ' + res.statusCode +
                ' when fetching credentials from EC2 API'));
            }
          });
        })
        .once('error', callback)
        .setTimeout(1000, callback);
      }
    }
  }
}

// Try to get access id and secret key from ec2 metadata API
function readCredentials(obj, cb) {
  let lapse = obj.expires == null ? 0 : +new Date() - Date.parse(obj.expires);
  if (obj.secretAccessKey == null || obj.accessKeyId == null || lapse > 0) {
    let md = init();
    md().call({endpoint: 'iam/security-credentials/'}, function(err, res) {
      if (err) return cb(err);
      if (typeof res === 'undefined') return cb(new Error('metadata API response undefined'));
      md().call({endpoint: 'iam/security-credentials/' + res.split('\n')[0]},
       function(err, res) {
        try {
          res = JSON.parse(res);
        } catch(e) {
          return cb(e);
        }
        if (res.SecretAccessKey === null)
          return cb(new Error("secretAccessKey and accessKeyId not provided and could not be determined."));
        obj.secretAccessKey = res.SecretAccessKey;
        obj.accessKeyId = res.AccessKeyId;
        obj.token = res.Token;
        obj.expires = res.Expiration;
        cb(null, obj);
      });
    });
  } else {
    cb(null, obj);
  }
}
