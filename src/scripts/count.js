// count nodes in the graph
require("dotenv").load({silent: true});
//var MessageQueue = require("../lib/message_queue");
//var graph = require('../lib/graphdb_connector');
var neo4j = require('neo4j-driver').v1;

function count() {
	var session = neo4j.driver('bolt://graphdb:7687').session()

	session.run('MATCH (n) RETURN COUNT(n)')
		.subscribe({
			onError: () => { session.close(); process.exit(1); },
			onNext: (record) => { console.log(record); },
			onCompleted: () => { session.close(); process.exit(); }
		});
}

function paths() {
	var session = neo4j.driver('bolt://graphdb:7687').session()

	session.run('Match p=((n) -[*5..10]-> (m)) return p limit 3;')
		.subscribe({
			onError: () => { session.close(); process.exit(1); },
			onNext: (record) => { record.get('p').segments.forEach(function(el, i) {console.log(el.start);}); },
			onCompleted: () => { session.close(); process.exit(); }
		});
};

function main() {
	paths();
}

main();
