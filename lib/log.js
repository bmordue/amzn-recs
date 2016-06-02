log_msg = function(level, obj, msg) {
	var logline = {
		timestamp: (new Date()).toUTCString(),
		level: level,
		message: msg,
		details: obj
	};
	console.log(JSON.stringify(logline));
};

module.exports = {
	error: function(obj, msg) { log_msg("ERROR", obj, msg); },
	warn: function(obj, msg) { log_msg(" WARN", obj, msg); },
	info: function(obj, msg) { log_msg(" INFO", obj, msg); },
	debug: function(obj, msg) { log_msg("DEBUG", obj, msg); }
};