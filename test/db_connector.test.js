require("dotenv").load({silent: true});
var DbConnector = require("../lib/db_connector");
var util = require("util");

describe("DbConnector", function() {
	
	it("should be instantiated", function() {
		var dbConnector = new DbConnector();
	});
	
	it("should get DB service root", function(done) {
		this.timeout(10000);
		var dbConnector = new DbConnector();
		dbConnector.db.http({ method: "GET", path: "/db/data/" }, function(err, body) {
			if (err) {
				return done(err);
			}
			console.log(util.format("Response body: %j", body));
			done();
		});
	});
	
});