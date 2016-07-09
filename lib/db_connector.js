require("dotenv").load({silent: true});
var async = require("async");
var log = require("./log");
var neo4j = require("neo4j");
var VError = require("verror");

var fail = function() {
	throw new Error("Missing required env var");
};

//TODO: review result passed to callback for each function
// if they're always [], is there any point...?

function DbConnector(options) {
	this.options = options;
	var dbUrl = process.env.DB_URL || fail();
	var dbUsername = process.env.DB_USERNAME || fail();
	var dbPassword = process.env.DB_PASSWORD || fail();

	this.db = new neo4j.GraphDatabase({
		url: dbUrl,
		auth: {username: dbUsername, password: dbPassword}
	});
}

DbConnector.prototype.init = function(callback) {
	this.db.cypher({query:"CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE"}, function(err, result) {
		if (err) {
			return callback(err);
		}
		this.db.cypher({query:"CREATE CONSTRAINT ON (author:Author) ASSERT author.name IS UNIQUE"}, callback);
	});
};

function buildMergeWithPriceQuery(data) {
	var mergeQueryStr;
	var mergeParams = {
		ASIN: data.ASIN,
		DetailPageURL: data.DetailPageURL,
		Title: data.ItemAttributes.Title,
		Author: data.ItemAttributes.Author
	};
	mergeQueryChunks = [];
	mergeQueryChunks.push("MERGE (b:Book { ASIN: {ASIN} })");
	mergeQueryChunks.push("SET b.DetailPageURL = {DetailPageURL}, b.Title = {Title}, b.Author = {Author}");
	if (data.price && data.currency) {
		mergeQueryChunks.push("SET b.Price = {Price}, b.Currency = {Currency}"); 
		mergeParams.Price = data.price;
		mergeParams.Currency = data.currency;
	}
	mergeQueryChunks.push("RETURN b");
	mergeQueryStr = mergeQueryChunks.join(" ");
	
	return { queryString: mergeQueryStr, params: mergeParams};
}

function createChildBookNode(db, data, callback) {
	var query = buildMergeWithPriceQuery(data);
	db.cypher({
		query: query.queryString,
		params: query.params
	}, function(err, result) {
		log.debug({result: result}, 'initial merge query complete');
		callback(err);
	});
}

function addParentChildRelation(db, parentAsin, childAsin, callback) {
	db.cypher({
		query: "MATCH (parent:Book {ASIN: {parentAsin}}),(child:Book {ASIN: {childAsin}}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r",
		params: {
			parentAsin: parentAsin,
			childAsin: childAsin
		}
	}, callback);
}

function addAuthorRelations(db, data, callback) {
	var authorList = data.ItemAttributes.Author;
	if (authorList.constructor !== Array ) {
		authorList = [authorList];
	}
	async.each(authorList, function(author, each_cb) {
		var queryStr =
			"MATCH (b:Book {ASIN: {childAsin}})" + 
			" MERGE (a:Author {name: {author}})" +
			" MERGE (b)<-[:AUTHOR_OF]-(a)";
		var params = {
			childAsin: data.ASIN,
			author: author
		};
		db.cypher({query: queryStr, params: params}, each_cb);
	}, callback);
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
			createChildBookNode(self.db, data, cb);
		},
		function(cb) {
			addParentChildRelation(self.db, parentAsin, data.ASIN, cb);
		},
		function(result, cb) {
			addAuthorRelations(self.db, data, cb);
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
	this.db.cypher({ query: query.queryString, params: query.params }, callback);
};

DbConnector.prototype.getBookNode = function(asin, callback) {
	this.db.cypher({
		query: "MATCH (n { ASIN: {ASIN} }) RETURN n",
		params: {
			ASIN: asin
		}
	}, callback);
};

DbConnector.prototype.deleteBookNode = function(asin, callback) {
	this.db.cypher({
		query: "MATCH (n { ASIN: {ASIN} }) DETACH DELETE n RETURN COUNT(n)",
		params: {
			ASIN: asin
		}
	}, callback);
};

DbConnector.prototype.countOutgoingRecommendations = function(asin, callback) {
	this.db.cypher({
		query: "MATCH (n { ASIN: {ASIN} })-[r]->() RETURN COUNT(DISTINCT r)",
		params: {
			ASIN: asin
		}
	}, function(err, result) {
		if (err) {
			return callback(err);
		}
		log.debug(result, "outgoing relationships");
		return callback(null, result);
	});
};

module.exports = DbConnector;