import * as http from "http";

module.exports = {
  readCredentials,
};

function metadata(options, callback) {
  const version = options.version || "latest";
  const endpoint = options.endpoint || "";
  const url = "http://169.254.169.254/" + version + "/meta-data/" + endpoint;

  http
    .get(url, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          return callback(null, data);
        } else {
          return callback(
            new Error(
              "HTTP " +
                res.statusCode +
                " when fetching credentials from EC2 API"
            )
          );
        }
      });
    })
    .once("error", callback)
    .setTimeout(1000, callback);
}

// Try to get access id and secret key from ec2 metadata API
function readCredentials(obj, cb) {

  function firstAttempt(err, res) {
    if (err) return cb(err);
    if (typeof res === "undefined")
      return cb(new Error("metadata API response undefined"));
    metadata(
      { endpoint: "iam/security-credentials/" + res.split("\n")[0] },
      secondAttempt
    );
  }

  function secondAttempt(_err, innerRes) {
    try {
      innerRes = JSON.parse(innerRes);
    } catch (e) {
      return cb(e);
    }
    if (innerRes.SecretAccessKey === null)
      return cb(
        new Error(
          "secretAccessKey and accessKeyId not provided and could not be determined."
        )
      );
    obj.secretAccessKey = innerRes.SecretAccessKey;
    obj.accessKeyId = innerRes.AccessKeyId;
    obj.token = innerRes.Token;
    obj.expires = innerRes.Expiration;
    cb(null, obj);
  }

  const lapse = obj.expires == null ? 0 : +new Date() - Date.parse(obj.expires);
  if (obj.secretAccessKey != null && obj.accessKeyId != null && lapse <= 0) {
    return cb(null, obj);
  }

  metadata({ endpoint: "iam/security-credentials/" }, firstAttempt);
}
