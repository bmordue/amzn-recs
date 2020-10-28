var util = require("util");

function Whitelist(options) {
}

Whitelist.prototype.add = function(token, callback) {
	return callback();
};

Whitelist.prototype.check = function(token, callback) {
	return callback(true);
};

module.exports = Whitelist;
