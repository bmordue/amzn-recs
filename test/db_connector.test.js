require("dotenv").load({silent: true});
var DbConnector = require("../lib/db_connector");
var should = require("should");
var util = require("util");

var LOG_ALL = false;

describe("DbConnector", function() {
	this.timeout(10000);
	
	var dbConnector = new DbConnector();
	
	var bookData = {
		"ASIN": "B014V4DXMW", 
		"DetailPageURL": "http://amzn.co/B014V4DXMW", 
		"ItemAttributes": {
			"Author": "China Mi\u00e9ville", 
			"Manufacturer": "Picador", 
			"ProductGroup": "eBooks", 
			"Title": "This Census-Taker"
		}
	};
	
	var childBookData = {
		"ASIN": "B01CDMP88Q",
		"DetailPageURL": "http://amzn.co/B01CDMP88Q",
		"ItemAttributes": {
			"Author": "Zen Cho",
			"ProductGroup": "eBooks",
			"Title": "The Terracotta Bride"
		}
	};
	
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
	
	var logAllRelationships = function(callback) {
		// if (!LOG_ALL) {
		// 	return callback();
		// }
		console.log("++++++ log all relationships for info");
		dbConnector.db.cypher({query: "MATCH ()-[r]->() RETURN r"}, function(err, result) {
			console.log(util.inspect(result, {depth: null, colors: true}));
			console.log("~~~~~~~");
			if (err) {
				console.log(err);
			}
			callback();
		});
	};
	
		
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
				result[0].n.properties.ASIN.should.equal(bookData.ASIN);
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
				result[0].n.properties.ASIN.should.equal(bookData.ASIN);
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
			var key = "COUNT(n)"
			result[0][key].should.eql(1);
			done();
		});
	});
	
	it("deleting a Book node using an ASIN that does not exist returns delete count 0", function(done) {
		dbConnector.deleteBookNode("rubbish_ASIN", function(err, result) {
			if (err) {
				return done(err);
			}
			var key = "COUNT(n)"
			result[0][key].should.eql(0);
			done();
		});
	});
	
	it("inserting a Book node as a child of another Book node that does not exist creates the child with no relationship", function(done) {
		dbConnector.createChildBookNode("rubbish_ASIN", childBookData, function(err, result) {
			if (err) {
				return done(err);
			}
			result.should.eql([]);
			dbConnector.getBookNode(bookData.ASIN, function(err, result) {
				if (err) {
					return done(err);
				}
				dbConnector.db.cypher({
					query: "MATCH (n {ASIN: {asin}}) RETURN n",
					params: { asin: childBookData.ASIN}
				}, function(err, result) {
					if (err) {
						return done(err);
					}
					result.length.should.equal(1); // new "child" node exists
					dbConnector.db.cypher({
						query: "MATCH (n {ASIN: {asin}})-[r]-() RETURN r",
						params: { asin: childBookData.ASIN}
					}, function(err, result) {
						if (err) {
							return done(err);
						}
						result.should.eql([]); // but there is no relationship
						done();
					});
				});
				
			});
		});
	});	
		
	it("insert a Book node as a child of another Book node", function(done) {
		dbConnector.createBookNode(bookData, function(err, result) {
			if (err) {
				return done(err);
			}
			dbConnector.createChildBookNode(bookData.ASIN, childBookData, function(err, result) {
				if (err) {
					return done(err);
				}
				dbConnector.db.cypher({
					query: "MATCH ({ ASIN: {parentAsin} })-[r]->({ ASIN: {childAsin} }) RETURN r",
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