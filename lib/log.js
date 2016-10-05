const VERBOSITY_VALUES = {
	"ERROR": 10,
	"WARN": 20,
	"INFO": 30,
	"DEBUG": 40
};

var output_verbosity = process.env.AMZN_RECS_LOG_LEVEL ? VERBOSITY_VALUES[process.env.AMZN_RECS_LOG_LEVEL] : "DEBUG";

var log_msg = function(level, obj, msg, verbosity) {
	if (verbosity > output_verbosity) {
		return;
	}
	var details = {};
	if (typeof obj !== 'object') {
		details.value = obj;
	} else if (obj != null) {
		details = obj;
	}

	var logline = {
		timestamp: (new Date()).toUTCString(),
		level: level,
		message: msg,
		details: details
	};
	console.log(JSON.stringify(logline));
};

module.exports = {
	error: function(obj, msg) { log_msg("ERROR", obj, msg, VERBOSITY_VALUES["ERROR"]); },
	warn: function(obj, msg) { log_msg(" WARN", obj, msg, VERBOSITY_VALUES["WARN"]); },
	info: function(obj, msg) { log_msg(" INFO", obj, msg, VERBOSITY_VALUES["INFO"]); },
	debug: function(obj, msg) { log_msg("DEBUG", obj, msg, VERBOSITY_VALUES["DEBUG"]); }
};
