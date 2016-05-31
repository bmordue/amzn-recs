var util = require("util");

log_msg = function(level, obj, msg) {
	var timestamp = (new Date()).toUTCString();
	console.log(util.format("%s %s: %s %j", timestamp, level, msg, obj));
};

module.exports = {
	error: function(obj, msg) { log_msg("ERROR", obj, msg); },
	warn: function(obj, msg) { log_msg(" WARN", obj, msg); },
	info: function(obj, msg) { log_msg(" INFO", obj, msg); },
	debug: function(obj, msg) { log_msg("DEBUG", obj, msg); }
};