const VERBOSITY_VALUES = {
	"ERROR": 10,
	"WARN": 20,
	"INFO": 30,
	"DEBUG": 40
};

var StatsD = require('node-statsd');
var statsd = new StatsD({
			prefix: 'amzn-recs_logging',
			host: process.env.STATSD_HOST ? process.env.STATSD_HOST : 'localhost'
		});

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
	error: function(obj, msg) {
		log_msg("ERROR", obj, msg, VERBOSITY_VALUES["ERROR"]);
		statsd.increment('errors_logged');
	},
	warn: function(obj, msg) {
		log_msg(" WARN", obj, msg, VERBOSITY_VALUES["WARN"]);
		statsd.increment('warnings_logged');
	},
	info: function(obj, msg) { log_msg(" INFO", obj, msg, VERBOSITY_VALUES["INFO"]); },
	debug: function(obj, msg) { log_msg("DEBUG", obj, msg, VERBOSITY_VALUES["DEBUG"]); }
};
