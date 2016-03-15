var util = require("util");

log_msg = function(level, obj, msg) {
	util.log(util.format("%s %s %j", level, msg, obj));
};

module.exports = {
	error: function(obj, msg) { log_msg("ERROR", obj, msg); },
	warn: function(obj, msg) { log_msg("WARN", obj, msg); },
	info: function(obj, msg) { log_msg("INFO", obj, msg); },
	debug: function(obj, msg) { log_msg("DEBUG", obj, msg); }
};