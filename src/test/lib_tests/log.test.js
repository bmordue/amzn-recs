var log = require("../../lib/log");

describe("logger", function() {
	var levels = ["error", "warn", "info", "debug"];
	levels.forEach(function(level) {
		it("should log at level " + level, function() {
			log[level]({details: 'none'}, "Logging at level " + level);
		});
	});
});