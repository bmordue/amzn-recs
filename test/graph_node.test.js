require("dotenv").load({silent: true});
var GraphNode = require("../lib/graph_node");

describe("GraphNode", function() {
	it("should be instantiated", function() {
		var gn = new GraphNode({});
	});
});