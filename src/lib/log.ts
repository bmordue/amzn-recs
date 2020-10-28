const VERBOSITY_VALUES = {
	"ERROR": 10,
	"WARN": 20,
	"INFO": 30,
	"DEBUG": 40
};

import StatsD = require('node-statsd');
const statsd = new StatsD({
			prefix: 'amzn-recs.logging.',
			host: process.env.STATSD_HOST ? process.env.STATSD_HOST : 'localhost'
		});

const output_verbosity = process.env.AMZN_RECS_LOG_LEVEL ? VERBOSITY_VALUES[process.env.AMZN_RECS_LOG_LEVEL] : "DEBUG";

const log_msg = function(level, obj, msg, verbosity) {
	if (verbosity > output_verbosity) {
		return;
	}
	let details = {
		value: null
	};
	if (typeof obj !== 'object') {
		details.value = obj;
	} else if (obj != null) {
		details = obj;
	}

	const logline = {
		timestamp: (new Date()).toUTCString(),
		level: level,
		message: msg,
		details: details
	};
	console.log(JSON.stringify(logline));
};

export function error(obj, msg) {
	log_msg("ERROR", obj, msg, VERBOSITY_VALUES["ERROR"]);
	statsd.increment('errors_logged');
}
export function warn(obj, msg) {
	log_msg(" WARN", obj, msg, VERBOSITY_VALUES["WARN"]);
	statsd.increment('warnings_logged');
}
export function info(obj, msg) { log_msg(" INFO", obj, msg, VERBOSITY_VALUES["INFO"]); }
export function debug(obj, msg) { log_msg("DEBUG", obj, msg, VERBOSITY_VALUES["DEBUG"]); }
