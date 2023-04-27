import * as http from 'http';

module.exports = {
  init,
  readCredentials
}

function init() {
  return () => {
    return {
      call(options, callback) {
        const version = options.version || 'latest';
        const endpoint = options.endpoint || '';
        const url = 'http://169.254.169.254/' + version + '/meta-data/' + endpoint;

        http.get(url, (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              return callback(null, data);
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
  const lapse = obj.expires == null ? 0 : +new Date() - Date.parse(obj.expires);
  if (obj.secretAccessKey == null || obj.accessKeyId == null || lapse > 0) {
    const md = init();
    md().call({endpoint: 'iam/security-credentials/'}, (err, res) => {
      if (err) return cb(err);
      if (typeof res === 'undefined') return cb(new Error('metadata API response undefined'));
      md().call({endpoint: 'iam/security-credentials/' + res.split('\n')[0]},
       (_err, innerRes) => {
        try {
          innerRes = JSON.parse(innerRes);
        } catch(e) {
          return cb(e);
        }
        if (innerRes.SecretAccessKey === null)
          return cb(new Error("secretAccessKey and accessKeyId not provided and could not be determined."));
        obj.secretAccessKey = innerRes.SecretAccessKey;
        obj.accessKeyId = innerRes.AccessKeyId;
        obj.token = innerRes.Token;
        obj.expires = innerRes.Expiration;
        cb(null, obj);
      });
    });
  } else {
    cb(null, obj);
  }
}
