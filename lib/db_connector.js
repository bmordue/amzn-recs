require("dotenv").load({silent: true});
var log = require("./log");
var neo4j = require("neo4j");
var VError = require("verror");

var fail = function() {
	throw new Error("Missing required env var");
};

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
	this.db.cypher({query:"CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE"}, callback);
};

DbConnector.prototype.createChildBookNode = function(parentAsin, data, callback) {
	// log.debug({}, "DbConnector.createChildBookNode");
	var self = this;
	if (!data.ItemAttributes) {
		log.warn(data, "Missing ItemAttributes!");
		return callback();		
	}
	if (!data.ItemAttributes.Author) {
		log.warn(data, "Missing Author field!");
		return callback();
	}
	var mergeQueryStr = "MERGE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author} }) RETURN n";
	var mergeParams = {
		ASIN: data.ASIN,
		DetailPageURL: data.DetailPageURL,
		Title: data.ItemAttributes.Title,
		Author: data.ItemAttributes.Author
	};
	try {
		this.db.cypher({
			query: mergeQueryStr,
			params: mergeParams
		}, function(err, result) {
			if (err) {
				log.error(err, "Error in createChildBookNode, merge child node");
				log.debug(mergeParams, "new node cannot be created because of constraint violation with params: ");
				query = "MATCH (n:Book { ASIN: {ASIN} }) RETURN n";
				params = { ASIN: data.ASIN };
				self.db.cypher({query: query, params: params}, function(err, result) { log.debug(result, "existing node causes constraint violation: "); });
				return callback(err);
			}
			self.db.cypher({
				query: "MATCH (parent:Book {ASIN: {parentAsin}}),(child:Book {ASIN: {childAsin}}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r",
				params: {
					parentAsin: parentAsin,
					childAsin: data.ASIN
				}
			}, function(err, result) {
				if (err) {
					log.error(err, "Error in createChildBookNode, create relationship");
				}
				callback(err, result);
			});
		});
	} catch (e) {
		log.error(e, "in catch block: ");
		callback(e, []);
	}
};

// unused?
DbConnector.prototype.createBookNode = function(data, callback) {
	// log.debug({}, "DbConnector.createBookNode");
	if (data.ItemAttributes.ProductGroup != "eBooks") {
		log.warn(data, "Expected ItemAttributes.ProductGroup to be eBooks");
	}
	this.db.cypher({
		query: "MERGE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author} }) RETURN n",
		params: {
			ASIN: data.ASIN,
			DetailPageURL: data.DetailPageURL,
			Title: data.ItemAttributes.Title,
			Author: data.ItemAttributes.Author
		}
	}, callback);
};

DbConnector.prototype.getBookNode = function(asin, callback) {
	// log.debug({}, "DbConnector.getBookNode");
	this.db.cypher({
		query: "MATCH (n { ASIN: {ASIN} }) RETURN n",
		params: {
			ASIN: asin
		}
	}, callback);
};

DbConnector.prototype.deleteBookNode = function(asin, callback) {
	// log.debug({}, "DbConnector.deleteBookNode");
	this.db.cypher({
		query: "MATCH (n { ASIN: {ASIN} }) DETACH DELETE n RETURN COUNT(n)",
		params: {
			ASIN: asin
		}
	}, callback);
};

DbConnector.prototype.countOutgoingRecommendations = function(asin, callback) {
	// log.warn({}, "DbConnector.countOutgoingRecommendations is stubbed out");
	// return callback(null, {count: 0});
	// log.debug({}, "DbConnector.countOutgoingRecommendations");
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
