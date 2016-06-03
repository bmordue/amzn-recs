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
	this.db.cypher({query:"CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE"}, callback);
};

function createChildBookNode(db, data, callback) {
	var mergeQueryStr;
	var mergeParams = {
		ASIN: data.ASIN,
		DetailPageURL: data.DetailPageURL,
		Title: data.ItemAttributes.Title,
		Author: data.ItemAttributes.Author
	};
	if (data.price && data.currency) {
		mergeQueryStr = "MERGE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author}, Price: {Price}, Currency: {Currency} }) RETURN n";
		mergeParams.Price = data.price;
		mergeParams.Currency = data.currency;
	} else {
		mergeQueryStr = "MERGE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author} }) RETURN n";
	}
	log.debug({}, "Finished setting mergeParams and mergeQueryStr");
	
	db.cypher({
		query: mergeQueryStr,
		params: mergeParams
	}, function(err, result) {
		log.debug({result: result}, 'initial merge query complete');
		newNodeResult = result;
		if (err) {
			if (err.neo4j && err.neo4j.code == "Neo.ClientError.Schema.ConstraintViolation") {
				log.warn(mergeParams, "new node cannot be created because of constraint violation with params: ");
				var query = "MATCH (n:Book { ASIN: {ASIN} }) RETURN n";
				var params = { ASIN: data.ASIN };
				db.cypher(
					{query: query, params: params}, 
					function(error, result) {
						if (error) {
							log.error(error, "Error in createChildBookNode, match child node causing constraint violation");
							return callback(error);
						}
						log.debug(result, "existing node causes constraint violation: ");
						log.debug({}, 'dropping error; ignore constraint violation');
						return callback();
				});
			} else {
				log.error(err, "Error in createChildBookNode, merge child node");
				return callback(err);
			}
		} else {
			callback(err);
		}
	});
}

function addParentChildRelation(db, parentAsin, childAsin, callback) {
	db.cypher({
		query: "MATCH (parent:Book {ASIN: {parentAsin}}),(child:Book {ASIN: {childAsin}}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r",
		params: {
			parentAsin: parentAsin,
			childAsin: childAsin
		}
	}, function(err, result) {
		callback(err);
	});
}

function addAuthorRelations(db, data, callback) {
	var authorList = data.ItemAttributes.Author;
	if (authorList.construcor !== Array ) {
		authorList = [authorList];
	}
	async.each(authorList, function(author, each_cb) {
		var queryStr = "MATCH (b:Book {ASIN: {childAsin}}) MERGE (b)<-[:AUTHOR_OF]-(a:Author {name: {author}})";
		var params = {
			childAsin: data.ASIN,
			author: author
		};
		db.cypher({query: queryStr, params: params}, function(err, result) {
			log.debug({err: err, result: result}, 'merge child relationship query complete');
			each_cb(err);
		});
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
		function(cb) {
			addAuthorRelations(self.db, data, cb);
		}
	], 
	function(err) {
		log.debug({err: err, result: newNodeResult}, 'Finished createChildBookNodeAndRelations()');
		return callback(err, newNodeResult);
	});
};

// unused?
DbConnector.prototype.createBookNode = function(data, callback) {
	if (data.ItemAttributes.ProductGroup != "eBooks") {
		log.warn(data, "Expected ItemAttributes.ProductGroup to be eBooks");
	}
	var queryStr;
	var params = {
		ASIN: data.ASIN,
		DetailPageURL: data.DetailPageURL,
		Title: data.ItemAttributes.Title,
		Author: data.ItemAttributes.Author
	};
	if (data.price && data.currency) {
		queryStr = "MERGE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author}, Price: {Price}, Currency: {Currency} }) RETURN n";
		params.Price = data.price;
		params.Currency = data.currency;
	} else {
		queryStr = "MERGE (n:Book { ASIN: {ASIN}, DetailPageURL: {DetailPageURL}, Title: {Title}, Author: {Author} }) RETURN n";
	}
	this.db.cypher({ query: queryStr, params: params }, callback);
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