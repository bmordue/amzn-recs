//TODO remove dotenv? or move to config.js
require("dotenv").load({silent: true});
var async = require("async");
var config = require("./config");
var log = require("./log");
var neo4j3 = require("neo4j-driver").v1;
var StatsD = require("node-statsd");

var statsd = new StatsD({
                        prefix: 'amzn-recs.graphdb_connector.',
                        host: process.env.STATSD_HOST ? process.env.STATSD_HOST : 'localhost'
                });


//TODO: review result passed to callback for each function
// if they're always [], is there any point...?

function DbConnector(options) {
	this.options = options;
	var dbUrl = config.get("DB_URL") || "bolt://graphdb:7687";
	var dbUsername = config.get("DB_USERNAME");
	var dbPassword = config.get("DB_PASSWORD");

	var auth = dbUsername && dbPassword ? neo4j3.auth.basic(dbUsername, dbPassword) : {};
	this.driver = neo4j3.driver(dbUrl, auth);
}


function closeAndCallback(callback, err, result) {
	if (err) {
		statsd.increment('query_error');
	} else {
		statsd.increment('query_complete');
	}
	session.close(function() {
		callback(err, result);
	});
}

DbConnector.prototype.init = function(callback) {
	const session = this.driver.session();

	session.run('CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE')
		.subscribe({
			onNext: ()=>{},
			onCompleted: function() {
				session.run('CREATE CONSTRAINT ON (author:Author) ASSERT author.name IS UNIQUE')
					.subscribe({
						onCompleted: function(summary) { closeAndCallback(callback, null, summary); },
						onError: function(err) { closeAndCallback(callback, err); }
					});
			},
			onError: function(err) { closeAndCallback(callback, err); }
		});
}

function buildMergeWithPriceQuery(data) {
	var mergeQueryStr;
	var mergeParams = {
		ASIN: data.ASIN,
		DetailPageURL: data.DetailPageURL,
		Title: data.ItemAttributes.Title,
		Author: data.ItemAttributes.Author
	};
	var mergeQueryChunks = [];
	mergeQueryChunks.push("MERGE (b:Book { ASIN: {ASIN} })");
	mergeQueryChunks.push("SET b.DetailPageURL = {DetailPageURL}, b.Title = {Title}, b.Author = {Author}");
	if (data.price && data.currency) {
		mergeQueryChunks.push("SET b.Price = {Price}, b.Currency = {Currency}");
		mergeParams.Price = data.price;
		mergeParams.Currency = data.currency;
	}
	if (data.ItemAttributes.ListPrice) {
		mergeQueryChunks.push("SET b.Price = {Price}, b.Currency = {Currency}");
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
			onCompleted: function(summary) {
				log.debug({result: summary}, 'initial merge query complete');
				closeAndCallback(callback);
			},
			onError: (err) => {
				closeAndCallback(callback, err);
			}
		});
}

function addParentChildRelation(driver, parentAsin, childAsin, callback) {
	const queryStr = "MATCH (parent:Book {ASIN: {parentAsin}}),(child:Book {ASIN: {childAsin}}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r";
	const params = {
		parentAsin: parentAsin,
		childAsin: childAsin
	};

	const session = driver.session();

	session.run(queryStr, params)
		.subscribe({
			onNext: ()=>{},
			onCompleted: function(summary) { closeAndCallback(callback, null, summary); },
			onError: function(err) { closeAndCallback(callback, err); }
		});
}

function addAuthorRelations(driver, data, callback) {
	var authorList = data.ItemAttributes.Author;
	if (authorList.constructor !== Array ) {
		authorList = [authorList];
	}
	const session = driver.session();
	async.each(authorList, function(author, each_cb) {
		var queryStr =
			"MATCH (b:Book {ASIN: {childAsin}})" +
			" MERGE (a:Author {name: {author}})" +
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
		closeAndCallback(callback, err, result);
	});
}

DbConnector.prototype.createChildBookNodeAndRelations = function(parentAsin, data, callback) {
	var self = this;
	if (!data.ItemAttributes) {
		log.warn(data, "Missing ItemAttributes!");
		return callback(null, []);
	}
	if (!data.ItemAttributes.Author) {
		log.warn(data, "Missing Author field!");
		return callback(null, []);
	}
	var newNodeResult = [];
	async.waterfall([
		function(cb) {
			createChildBookNode(self.driver, data, cb);
		},
		function(cb) {
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
	if (data.ItemAttributes.ProductGroup != "eBooks") {
		log.warn(data, "Expected ItemAttributes.ProductGroup to be eBooks");
	}
	var query = buildMergeWithPriceQuery(data);
	const session = this.driver.session();

	session.run(query.text, query.params)
		.subscribe({
			onNext: ()=>{},
			onCompleted: function() { closeAndCallback(callback); },
			onError: function(err) { closeAndCallback(callback, err); }
		});
};

function simpleQuery(connector, query, callback) {
	const session = connector.driver.session();

	var singleResult = null;
	session.run(query)
		.subscribe({
			onNext: function(result) { singleResult = result; },
			onCompleted: function(summary) {
				closeAndCallback(callback, null, singleResult);
			},
			onError: function(err) { closeAndCallback(callback, err); }
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
	var text = "MATCH (n { ASIN: {ASIN} }) RETURN n";
	simpleQueryForAsin(this, text, asin, callback);
};

DbConnector.prototype.deleteBookNode = function(asin, callback) {
	var text = "MATCH (n { ASIN: {ASIN} }) DETACH DELETE n RETURN COUNT(n)";
	simpleQueryForAsin(this, text, asin, callback);
};

DbConnector.prototype.countOutgoingRecommendations = function(asin, callback) {
	var query = {
		text: "MATCH (n { ASIN: {ASIN} })-[r]->() RETURN COUNT(DISTINCT r) AS outgoing",
		params: { ASIN: asin }
	};
	var session = this.driver.session();

	session.run(query)
		.subscribe({
			onNext: function(result) {
				log.debug({result: result}, 'outgoing relationships');
			},
			onCompleted: function(summary) {
				closeAndCallback(callback, null, summary);
			},
			onError: function(err) { closeAndCallback(callback, err); }
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


module.exports = DbConnector;
