import async = require("async");
import config = require("./config");
import log = require("./log");
import neo4j = require("neo4j-driver");
import StatsD = require("node-statsd");

var statsd = new StatsD({
                        prefix: 'amzn-recs.graphdb_connector.',
                        host: process.env.STATSD_HOST || 'localhost'
                });


//TODO: review result passed to callback for each function
// if they're always [], is there any point...?

function DbConnector(options) {
	this.options = options;
//	var dbUrl = config.get("DB_URL") || "bolt://graphdb:7687";
//	var dbUsername = config.get("DB_USERNAME");
//	var dbPassword = config.get("DB_PASSWORD");

	var dbUrl = 'bolt://192.168.0.48:7687';
	var dbUsername = 'neo4j';
	var dbPassword = 'tester';

//	var auth = dbUsername && dbPassword ? neo4j.auth.basic(dbUsername, dbPassword) : {};
	var auth = neo4j.auth.basic(dbUsername, dbPassword);
	this.driver = neo4j.driver(dbUrl, auth);
}


function closeAndCallback(callback, session, err, result) {
	log.debug(null, "closeAndCallback");
	if (err) {
		log.error(err);
		statsd.increment('query_error');
	} else {
		statsd.increment('query_complete');
	}
	if (typeof callback != 'function') {
		log.error(new Error().stack, 'closeAndCallback: callback is not a function');
	}
	session.close().then(callback);

//	session.close(function() {
//		callback(err, result);
//	});
}

DbConnector.prototype.init = function(callback) {
	const session = this.driver.session();

	session.run('CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE')
		.subscribe({
			onNext: ()=>{},
			onCompleted: function() {
				session.run('CREATE CONSTRAINT ON (author:Author) ASSERT author.name IS UNIQUE')
					.subscribe({
						onCompleted: function(summary) { closeAndCallback(callback, session, null, summary); },
						onError: function(err) { closeAndCallback(callback, session, err); }
					});
			},
			onError: function(err) { closeAndCallback(callback, session, err); }
		});
}

function buildMergeWithPriceQuery(data) {
	var mergeQueryStr;

	var mergeQueryChunks = [];
	mergeQueryChunks.push("MERGE (b:Book { ASIN: $ASIN })");

	var mergeParams = {
		ASIN: data.ASIN,
	};
	if (data.ItemAttributes && data.ItemAttributes.Title && data.ItemAttributes.Author) {
		mergeParams.Title = data.ItemAttributes.Title;
		mergeParams.Author = data.ItemAttributes.Author;
		mergeQueryChunks.push("SET b.Title = $Title, b.Author = $Author");
	}
	if (data.price && data.currency) {
		mergeQueryChunks.push("SET b.Price = $Price, b.Currency = $Currency");
		mergeParams.Price = data.price;
		mergeParams.Currency = data.currency;
	}
	if (data.ItemAttributes && data.ItemAttributes.ListPrice) {
		mergeQueryChunks.push("SET b.Price = $Price, b.Currency = $Currency");
		mergeParams.Price = data.ItemAttributes.ListPrice.Amount / 100;
		mergeParams.Currency = data.ItemAttributes.ListPrice.CurrencyCode;
	}

	mergeQueryChunks.push("RETURN b");
	mergeQueryStr = mergeQueryChunks.join(" ");

	return { text: mergeQueryStr, params: mergeParams };
}

function createChildBookNode(driver, data, callback) {
	var query = buildMergeWithPriceQuery(data);
	const session = driver.session();

	if (!query.params) {
		log.warn(query, 'Empty params object');
	}

	var text = query.text;
	session.run(text, query.params)
		.subscribe({
			onNext: ()=>{},
			onCompleted: function() {
				return closeAndCallback(callback, session);
			},
			onError: (err) => {
				log.debug(query, 'failed query');
				log.debug(err);
				return closeAndCallback(callback, session, err);
			}
		});
}

function addParentChildRelation(driver, parentAsin, childAsin, callback) {
	const queryStr = "MATCH (parent:Book {ASIN: $parentAsin}),(child:Book {ASIN: $childAsin}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r";
	const params = {
		parentAsin: parentAsin,
		childAsin: childAsin
	};

	const session = driver.session();

	session.run(queryStr, params)
		.subscribe({
			onNext: ()=>{},
			onCompleted: function(summary) {
				closeAndCallback(callback, session, null, summary);
			},
			onError: function(err) { closeAndCallback(callback, session, err); }
		});
}

function addAuthorRelations(driver, data, callback) {
	if (!data.ItemAttributes || !data.ItemAttributes.Author) {
		return callback(null, {});
	}
	var authorList = data.ItemAttributes.Author;
	if (authorList.constructor !== Array ) {
		authorList = [authorList];
	}
	const session = driver.session();
	async.each(authorList, function(author, each_cb) {
		var queryStr =
			"MATCH (b:Book {ASIN: $childAsin})" +
			" MERGE (a:Author {name: $author})" +
			" MERGE (b)<-[:AUTHOR_OF]-(a)";
		var params = {
			childAsin: data.ASIN,
			author: author
		};
		session.run(queryStr, params)
			.subscribe({
				onNext: ()=>{},
				onCompleted: function() { each_cb(); },
				onError: each_cb}
			);
	}, function(err, result) {
		closeAndCallback(callback, session, err, result);
	});
}

// TODO: what is the purpose of newNodeResult?
DbConnector.prototype.createChildBookNodeAndRelations = function(parentAsin, data, callback) {
	var self = this;
	var newNodeResult = [];
	async.waterfall([
		function(cb) {
			createChildBookNode(self.driver, data, cb);
		},
		function(result, cb) {
			addParentChildRelation(self.driver, parentAsin, data.ASIN, cb);
		},
		function(result, cb) {
			addAuthorRelations(self.driver, data, cb);
		}
		],
	function(err) {
		return callback(err, newNodeResult);
	});
};

// TODO: createBookNode and createChildBookNode seem too similar; remove one
DbConnector.prototype.createBookNode = function(data, callback) {
	log.debug(null, "DbConnector.createBookNode");
	if (data.ItemAttributes.ProductGroup != "eBooks") {
		log.warn(data, "Expected ItemAttributes.ProductGroup to be eBooks");
	}
	var query = buildMergeWithPriceQuery(data);
	const session = this.driver.session();
	log.debug(query, "Query: ");

	session.run(query.text, query.params)
		.subscribe({
			onNext: ()=>{log.debug(null, "onNext");},
			onCompleted: function() { log.debug(null, "onCompleted"); closeAndCallback(callback, session); },
			onError: function(err) { log.debug({err: err, query: query}, "onError: "); closeAndCallback(callback, session, err); }
		});
};

function simpleQuery(connector, query, callback) {
	const session = connector.driver.session();

	var records = [];
	session.run(query)
		.subscribe({
			onNext: function(record) {
				records.push(record);
			},
			onCompleted: function() {
				closeAndCallback(callback, session, null, records);
			},
			onError: function(err) { closeAndCallback(callback, session, err); }
		});
}

function simpleQueryForAsin(connector, text, asin, callback) {
	var query = {
		text: text,
		parameters: { ASIN: asin }
	};
	simpleQuery(connector, query, callback);
}

DbConnector.prototype.getBookNode = function(asin, callback) {
	var text = "MATCH (n { ASIN: $ASIN }) RETURN n";
	simpleQueryForAsin(this, text, asin, callback);
};

DbConnector.prototype.deleteBookNode = function(asin, callback) {
	var text = "MATCH (n { ASIN: $ASIN }) DETACH DELETE n RETURN COUNT(n)";
	simpleQueryForAsin(this, text, asin, callback);
};

DbConnector.prototype.countOutgoingRecommendations = function(asin, callback) {
	var query = {
		text: "MATCH (n { ASIN: $ASIN })-[r]->() RETURN COUNT(DISTINCT r) AS outgoing",
		params: { ASIN: asin }
	};
	var session = this.driver.session();

	session.run(query)
		.subscribe({
			onNext: function(result) {
				log.debug({result: result}, 'outgoing relationships');
			},
			onCompleted: function(summary) {
				closeAndCallback(callback, session, null, summary);
			},
			onError: function(err) { closeAndCallback(callback, session, err); }
		});
};

DbConnector.prototype.listAllAsins = function(callback) {
	var query = {
		text: "MATCH (n:Book) RETURN n.ASIN AS asin",
		params: {}
	};
	simpleQuery(this, query, function(err, summary) {
		callback(err, summary);
	});
}

DbConnector.prototype.listLeafNodeAsins = function(callback) {
	var query = {
		text: "MATCH (n) WHERE NOT (n)-->() RETURN n.ASIN as asin;",
		params: {}
	};
	simpleQuery(this, query, function(err, summary) {
		callback(err, summary);
	});
}

DbConnector.prototype.close = function() {
	this.driver.close();
}

DbConnector.prototype.getPath = function(startAsin, finishAsin, callback) {
	var query = {
		text: "MATCH p=((a:Book {ASIN: $start}) -[*1..10]-> (b:Book {ASIN: $finish})) RETURN p LIMIT 1;",
		parameters: {
			start: startAsin,
			finish: finishAsin
		}
	};
	simpleQuery(this, query, callback);
}

DbConnector.prototype.count = function(callback) {
	simpleQuery(this, {text: "MATCH (n) RETURN COUNT(n)"}, callback);
}


module.exports = DbConnector;
