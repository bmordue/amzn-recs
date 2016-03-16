require("dotenv").load({silent: true});
var GraphNode = require("./graph_node");
var log = require("./log");
var neo4j = require("neo4j");
var VError = require("verror")

var fail = function() {
	throw new Error("Missing required env var");
};

function DbConnector() {
	var dbUrl = process.env.DB_URL || fail();
	var dbUsername = process.env.DB_USERNAME || fail();
	var dbPassword = process.env.DB_PASSWORD || fail();
	
	this.db = new neo4j.GraphDatabase({
		url: dbUrl,
		auth: {username: dbUsername, password: dbPassword}
	});
}

DbConnector.prototype.createChildBookNode = function(parentAsin, data, callback) {
	log.debug({}, "DbConnector.createChildBookNode");
	var self = this;
	if (!data.ItemAttributes) {
		log.debug(data, "Missing ItemAttributes!");
		return callback();		
	}
	if (!data.ItemAttributes.Author) {
		log.debug(data, "Missing Author field!");
		return callback();
	}
	
	this.db.cypher({
		query: "MERGE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author} }) RETURN n",
		params: {
			ASIN: data.ASIN,
			DetailPageURL: data.DetailPageURL,
			Title: data.ItemAttributes.Title,
			Author: data.ItemAttributes.Author
		}
	}, function(err, result) {
		if (err) {
			return callback(err);
		}
		self.db.cypher({
			query: "MATCH (parent:Book {ASIN: {parentAsin}}),(child:Book {ASIN: {childAsin}}) CREATE (parent)-[r:SIMILAR_TO]->(child) RETURN r",
			params: {
				parentAsin: parentAsin,
				childAsin: data.ASIN
			}
		}, callback);
	});
};

// unused?
DbConnector.prototype.createBookNode = function(data, callback) {
	// log.debug({}, "DbConnector.createBookNode");
	if (data.ItemAttributes.ProductGroup != "eBooks") {
		log.warn(data, "Expected ItemAttributes.ProductGroup to be eBooks");
	}
	this.db.cypher({
		query: "CREATE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author} })",
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
		query: "MATCH (n { ASIN: {ASIN} }) DETACH DELETE n",
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