require("dotenv").load({silent: true});
var DbConnector = require("../../lib/graphdb_connector");
var fs = require("fs");
var path = require("path");
var should = require("should");
var test_utils = require("../test_utils");
var util = require("util");

var LOG_ALL = false;

describe("DbConnector", function() {
	if (process.env.RUN_UNSAFE_TESTS !== "true") {
		console.log("RUN_UNSAFE_TESTS is not set to true; exiting");
		return;
	}
	this.timeout(10000);

	var dbConnector = new DbConnector();

	var bookData = JSON.parse(fs.readFileSync(path.join("test", "fixtures", "simple_item_1.json")));

	var childBookData = JSON.parse(fs.readFileSync(path.join("test", "fixtures", "simple_item_2.json")));

	var logAllNodes = function(callback) {
		if (!LOG_ALL) {
			return callback();
		}
		console.log("====== log all nodes for info");
		dbConnector.db.cypher({query: "MATCH (n) RETURN n"}, function(err, result) {
			console.log(util.inspect(result, {depth: null, colors: true}));
			console.log("------");
			if (err) {
				console.log(err);
			}
			callback();
		});
	};


	before(function(done) {
		console.log('Detach-delete all existing nodes');
		dbConnector.db.cypher({query: 'MATCH (n) DETACH DELETE n'}, done);
	});


	it("get DB service root", function(done) {
		dbConnector.db.http({ method: "GET", path: "/db/data/", raw: true }, function(err, result) {
			if (err) {
				return done(err);
			}
			result.statusCode.should.equal(200);
			return done();
		});
	});

	it("create a Book node", function(done) {
		dbConnector.createBookNode(bookData, function(err, result) {
			if (err) {
				return done(err);
			}
			try {
				result[0].b.properties.ASIN.should.equal(bookData.ASIN);
			} catch (e) {
				return done(e);
			}
			done();
		});
	});

	it("create an identical Book node should not return an error", function(done) {
		dbConnector.createBookNode(bookData, function(err, result) {
			if (err) {
				return done(err);
			}
			try {
				result[0].b.properties.ASIN.should.equal(bookData.ASIN);
			} catch (e) {
				return done(e);
			}
			done();
		});
	});


	it("get a Book node by ASIN", function(done) {
		dbConnector.getBookNode(bookData.ASIN, function(err, result) {
			if (err) {
				return done(err);
			}
			result[0].n.properties.ASIN.should.equal(bookData.ASIN);
			done();
		});
	});

	it("getting a Book node by ASIN that does not exist returns an empty result", function(done) {
		dbConnector.getBookNode("rubbish_ASIN", function(err, result) {
			if (err) {
				return done(err);
			}
			result.should.eql([]);
			done();
		});
	});


	it("deleting a Book node by ASIN returns delete count 1", function(done) {
		dbConnector.deleteBookNode(bookData.ASIN, function(err, result) {
			if (err) {
				return done(err);
			}
			var key = "COUNT(n)";
			result[0][key].should.eql(1);
			done();
		});
	});

	it("deleting a Book node using an ASIN that does not exist returns delete count 0", function(done) {
		dbConnector.deleteBookNode("rubbish_ASIN", function(err, result) {
			if (err) {
				return done(err);
			}
			var key = "COUNT(n)";
			result[0][key].should.eql(0);
			done();
		});
	});

	it("inserting a Book node as a child of another Book node that does not exist creates the child with no relationship", function(done) {
		dbConnector.createChildBookNodeAndRelations("rubbish_ASIN", childBookData, function(err) {
			if (err) {
				return done(err);
			}
			test_utils.checkOnlyOneNodeMatchesAsin(dbConnector, {asin: childBookData.ASIN}, function(err) { // new "child" node exists
				if (err) {
					return done(err);
				}
				dbConnector.db.cypher({
					query: "MATCH (n {ASIN: {asin}})-[r:SIMILAR_TO]-() RETURN r",
					params: { asin: childBookData.ASIN}
				}, function(err, result) {
					if (err) {
						return done(err);
					}
					try {
						result.should.eql([]); // but there is no SIMILAR_TO relationship
					} catch (e) {
						return done(e);
					}
					done();
				});
			});
		});
	});

	it("insert a Book node as a child of another Book node", function(done) {
		dbConnector.createBookNode(bookData, function(err) {
			if (err) {
				return done(err);
			}
			dbConnector.createChildBookNodeAndRelations(bookData.ASIN, childBookData, function(err) {
				if (err) {
					return done(err);
				}
				dbConnector.db.cypher({
					query: "MATCH ({ ASIN: {parentAsin} })-[r:SIMILAR_TO]->({ ASIN: {childAsin} }) RETURN r",
					params: {
						parentAsin: bookData.ASIN,
						childAsin: childBookData.ASIN
					}
				}, function(err, result) {
					if (err) {
						return done(err);
					}
					should.exist(result[0].r);
					done();
				});
			});
		});
	});


	afterEach(logAllNodes);

	// after(function(done) {
	// 	var deleteQuery = "MATCH (n {ASIN: {asin}}) DETACH DELETE n";
	// 	dbConnector.db.cypher({query: deleteQuery, params: { asin: bookData.ASIN}}, function(err, result) {
	// 		if (err) {
	// 			console.log(err);
	// 		}
	// 		dbConnector.db.cypher({query: deleteQuery, params: { asin: childBookData.ASIN}}, function(err, result) {
	// 			if (err) {
	// 				console.log(err);
	// 			}
	// 			logAllNodes(done);
	// 		});
	// 	});
	// });

});
