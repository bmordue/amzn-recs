var log = require("./log");

function GraphNode(data) {
	this.data = data;
}

GraphNode.prototype.countOutgoingRecommendations = function(callback) {
	log.warn({}, 'GraphNode.countOutgoingRecommendations() is currently a stub');
	return callback(null, {count:0})
};

module.exports = GraphNode;