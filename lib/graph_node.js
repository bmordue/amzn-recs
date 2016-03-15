function GraphNode(data) {
	this.data = data;
}

GraphNode.prototype.countOutgoingRecommendations = function(callback) {
	console.log('WARN: GraphNode.countOutgoingRecommendations() is currently a stub');
	return callback(null, {count:0})
};

module.exports = GraphNode;