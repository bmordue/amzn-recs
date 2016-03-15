require("dotenv").load({silent: true});
var GraphNode = require("./graph_node");

function DbConnector() {
	
}

DbConnector.prototype.getNode = function(asin, callback) {
	console.log('WARN DbConnector.getNode is currently a stub');
	return callback(null, new GraphNode({}));
};

module.exports = DbConnector;