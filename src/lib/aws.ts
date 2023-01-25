
var http = require("http");
var https = require("https");
var qs = require("querystring");
var xml2js = require("xml2js");
var utils = require('./utils');
var _ = require('underscore');
var metadata = require('./metadata');


// aws-lib/prodAdv
function init(genericAWSClient) {
    return createProdAdvClient;

    function createProdAdvClient(accessKeyId, secretAccessKey, associateTag, options) {
        options = options || {};
        var client = genericAWSClient({
            host: options.host || "ecs.amazonaws.com",
            path: options.path || "/onca/xml",
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            secure: options.secure
        });

        return {
            client: client,
            call: call
        };

        function call(action, query, callback) {
            query["Operation"] = action
            query["Service"] = "AWSECommerceService"
            query["Version"] = options.version || '2009-10-01'
            query["AssociateTag"] = associateTag;
            query["Region"] = options.region || "US"
            return client.call(action, query, callback);
        }
    }
}

// aws.js

// a generic AWS API Client which handles the general parts
function genericAWSClient(obj) {
    var securityToken = obj.token;
    var signHeader = obj.signHeader;
    var host = obj.host;
    var accessKeyId = obj.accessKeyId;
    var path = obj.path;
    var agent = obj.agent;
    var secretAccessKey = obj.secretAccessKey;
    var secure = obj.secure == null ? true : false;
    var connection = secure ? https : http;

    return { call: call };

    function call(action, query, callback) {
        // Wrap the callback to prevent it from being called multiple times.
        callback = (function (next) {
            var isCalled = false;
            return function () {
                if (isCalled) return;
                isCalled = true;
                next.apply(null, arguments);
            }
        })(callback)

        // Try to set credentials with metadata API if no credentials provided
        metadata.readCredentials(obj, function (err) {
            if (err) return callback(err);
            var date = new Date();

            query = addQueryProperties(query, securityToken, accessKeyId, date);
            var body = qs.stringify(query);
            var headers = createHeaders(host, body.length, date, securityToken, accessKeyId, secretAccessKey);
            sendRequest();
            return;

            function sendRequest() {
                var options = {
                    host: host,
                    path: path,
                    agent: agent,
                    method: 'POST',
                    headers: headers
                };
                var req = connection.request(options, function (res) {
                    var data = '';
                    //the listener that handles the response chunks
                    res.addListener('data', function (chunk) {
                        data += chunk.toString()
                    })
                    res.addListener('end', function () {
                        var parser = new xml2js.Parser();
                        parser.addListener('end', function (result) {
                            if (typeof result != "undefined") {
                                var err = result.Error || (result.Errors ? result.Errors.Error : null)
                                if (err) {
                                    callback(new Error(err.Message), result)
                                } else {
                                    callback(null, result)
                                }
                            } else {
                                callback(new Error('Unable to parse XML from AWS.'))
                            }
                        });
                        parser.parseString(data);
                    })
                    res.addListener('error', callback)
                });
                req.write(body)
                req.addListener('error', callback)
                req.end()
            }
        });
    }

    function addQueryProperties(query, securityToken, accessKeyId, date) {
        var extendedQuery = _.clone(query);
        if (securityToken) extendedQuery["SecurityToken"] = securityToken;
        extendedQuery["Timestamp"] = date.toISOString();
        extendedQuery["AWSAccessKeyId"] = accessKeyId;
        extendedQuery["Signature"] = signQuery(extendedQuery);
        return extendedQuery;
    }

    function createHeaders(host, bodyLength, date, securityToken, accessKeyId, secretAccessKey) {
        var headers = {
            "Host": host,
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
            "Content-Length": bodyLength
        };

        if (signHeader) {
            headers["Date"] = date.toUTCString();
            if (securityToken !== undefined) headers["x-amz-security-token"] = securityToken;
            headers["x-amzn-authorization"] =
                "AWS3-HTTPS " +
                "AWSAccessKeyId=" + accessKeyId + ", " +
                "Algorithm=HmacSHA256, " +
                "Signature=" + utils.hmacSha256(secretAccessKey, date.toUTCString());
        }
        return headers;
    }

    function signQuery(query) {
        var keys = []
        var sorted = {}

        for (var key in query)
            keys.push(key)

        keys = keys.sort()

        for (var n in keys) {
            const theKey = keys[n]
            sorted[theKey] = query[theKey]
        }
        var stringToSign = ["POST", host, path, qs.stringify(sorted)].join("\n");

        // Amazon signature algorithm seems to require this
        stringToSign = stringToSign.replace(/!/g, "%21");
        stringToSign = stringToSign.replace(/'/g, "%27");
        stringToSign = stringToSign.replace(/\*/g, "%2A");
        stringToSign = stringToSign.replace(/\(/g, "%28");
        stringToSign = stringToSign.replace(/\)/g, "%29");

        return utils.hmacSha256(secretAccessKey, stringToSign);
    }
}

exports.createProdAdvClient = init(genericAWSClient);
