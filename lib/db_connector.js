require("dotenv").load({silent: true});
var GraphNode = require("./graph_node");
var neo4j = require('neo4j');

var fail = function() {
	throw new Error("Missing required env var");
};

function DbConnector(options) {
	var dbUrl = process.env.DB_URL || fail();
	var dbUsername = process.env.DB_USERNAME || fail();
	var dbPassword = process.env.DB_PASSWORD || fail();
	
	this.db = new neo4j.GraphDatabase({
		url: dbUrl,
		auth: {username: dbUsername, password: dbPassword}
	});
}

DbConnector.prototype.createBookNode = function(data, callback) {
	this.db.cypher({
		query: "CREATE (n:Book { name : name, title : title})",
		params: {
			name: "",
			title: ""
		}
	}, callback);
};

DbConnector.prototype.getNode = function(asin, callback) {
	console.log('WARN DbConnector.getNode is currently a stub');
	return callback(null, new GraphNode({}));
};

module.exports = DbConnector;