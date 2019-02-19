require("dotenv").load({silent: true});
var async = require("async");
var config = require("./config");
var log = require("./log");
var neo4j3 = require("neo4j-driver").v1;

//TODO: review result passed to callback for each function
// if they're always [], is there any point...?

function DbConnector(options) {
	this.options = options;
	var dbUrl = config.get("DB_URL") || "bolt://graphdb";
	var dbUsername = config.get("DB_USERNAME");
	var dbPassword = config.get("DB_PASSWORD");

	var auth = dbUsername && dbPassword ? neo4j3.auth.basic(dbUsername, dbPassword) : null;
	this.driver = neo4j3.driver(dbUrl, auth);
}

DbConnector.prototype.init = function(callback) {
	const session = this.driver.session();

	var closeAndCallback = function(err, result) {
		session.close(function() {
			callback(err, result);
		});
	};

	session.run('CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE')
		.subscribe({
			onCompleted: function() {
				session.run('CREATE CONSTRAINT ON (author:Author) ASSERT author.name IS UNIQUE')
					.subscribe({
						onCompleted: function(summary) { closeAndCallback(null, summary); },
						onError: closeAndCallback
					});
			},
			onError: closeAndCallback
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

	return { queryString: mergeQueryStr, params: mergeParams};
}

function createChildBookNode(driver, data, callback) {
	var query = buildMergeWithPriceQuery(data);

	const session = driver.session();

	var closeAndCallback = function(err, result) {
		session.close(function() {
			callback(err, result);
		});
	};

	session.run(query.queryString, query.params)
		.subscribe({
			onCompleted: function(summary) {
				log.debug({result: summary}, 'initial merge query complete');
				closeAndCallback();
			},
			onError: closeAndCallback
		});
}

function addParentChildRelation(driver, parentAsin, childAsin, callback) {
	const queryStr = "MATCH (parent:Book {ASIN: {parentAsin}}),(child:Book {ASIN: {childAsin}}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r";
	const params = {
		parentAsin: parentAsin,
		childAsin: childAsin
	};

	const session = driver.session();

	var closeAndCallback = function(err, result) {
		session.close(function() {
			callback(err, result);
		});
	};

	session.run(queryStr, params)
		.subscribe({
			onCompleted: function(summary) { closeAndCallback(null, summary); },
			onError: closeAndCallback
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
				onCompleted: function() { each_cb(); }, 
				onError: each_cb}
			);
	}, function(err, result) {
		session.close(function() {
			callback(err, result);
		});
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
	log.debug({query: query}, "Query graph DB");

	const session = this.driver.session();

	var closeAndCallback = function(err, result) {
		session.close(function() {
			callback(err, result);
		});
	};

	session.run(query.queryString, query.params)
		.subscribe({
			onCompleted: function() { closeAndCallback(); },
			onError: closeAndCallback
		});
};

function simpleQuery(connector, query, callback) {
	const session = connector.driver.session();

	var closeAndCallback = function(err, result) {
		session.close(function() {
			callback(err, result);
		});
	};

	var singleResult = null;
	session.run(query)
		.subscribe({
			onNext: function(result) { singleResult = result; },
			onCompleted: function(summary) { closeAndCallback(null, singleResult); },
			onError: closeAndCallback
		});
}

function simpleQueryForAsin(connector, text, asin, callback) {
	var query = {
		text: text,
		ASIN: asin
	};
	simpleQuery(connector, query, callback);
}

DbConnector.prototype.getBookNode = function(asin, callback) {
	var text = "MATCH (n { ASIN: {ASIN} }) RETURN n";
	simpleQuery(this, text, asin, callback);
};

DbConnector.prototype.deleteBookNode = function(asin, callback) {
	var text = "MATCH (n { ASIN: {ASIN} }) DETACH DELETE n RETURN COUNT(n)";
	simpleQuery(this, text, asin, callback);
};

DbConnector.prototype.countOutgoingRecommendations = function(asin, callback) {
	var query = {
		text: "MATCH (n { ASIN: {ASIN} })-[r]->() RETURN COUNT(DISTINCT r) AS outgoing",
		params: { ASIN: asin }
	};

	var session = this.driver.session();

	var closeAndCallback = function(err, result) {
		session.close(function() {
			callback(err, result);
		});
	};

	session.run(query)
		.subscribe({
			onNext: function(result) {
				log.debug({result: result}, 'outgoing relationships');
			},
			onCompleted: function(summary) {
				closeAndCallback(null, summary);
			},
			onError: closeAndCallback
		});
};

DbConnector.prototype.listAllAsins = function(callback) {
	var query = {
		text: "MATCH (n:Book) RETURN n.ASIN AS asin",
		params: {}
	};
	simpleQuery(this, query, function(err, summary) {
		log.debug({summary: summary}, 'listed all ASINs');
		callback(err, summary);
	});
}

DbConnector.prototype.listLeafNodeAsins = function(callback) {
	var query = {
		text: "MATCH (n) WHERE NOT (n)-->() RETURN n.ASIN as asin;",
		params: {}
	};
	simpleQuery(this, query, function(err, summary) {
		log.debug({summary: summary}, 'listed all leaf node ASINs');
		callback(err, summary);
	});
}

DbConnector.prototype.close = function(callback) {
	this.driver.close();
}


module.exports = DbConnector;
