// count nodes in the graph
require("dotenv").load({silent: true});
//var MessageQueue = require("../lib/message_queue");
//var graph = require('../lib/graphdb_connector');
var neo4j = require('neo4j-driver').v1;
const util = require('util');

function simpleQuery(queryStr, callback) {
	var session = neo4j.driver('bolt://graphdb:7687').session()

	session.run(queryStr)
		.subscribe({
			onError: () => { session.close(); process.exit(1); },
			onNext: (record) => { console.log(util.inspect(record, {compact: false, depth: 5})); },
			onCompleted: () => { console.log('Finished ' + queryStr); session.close(callback); }
		});
}

function count(callback) {
	simpleQuery('MATCH (n) RETURN COUNT(n)', callback);
}

function cheap() {
	var session = neo4j.driver('bolt://graphdb:7687').session()

	var query = 'MATCH (b) RETURN COUNT(b)';
	session.run(query).subscribe({
			onError: () => { session.close(); process.exit(1); },
			onNext: (record) => { console.log(record); },
			onCompleted: (summary) => {
//			console.log(summary);
			session.close(); process.exit();
			}
	});
}

function paths() {
	var session = neo4j.driver('bolt://graphdb:7687').session()

	session.run('Match p=((n) -[*11]-> (m)) return p limit 3;')
		.subscribe({
			onError: () => { session.close(); process.exit(1); },
			onNext: (record) => { record.get('p').segments.forEach(function(el, i) {console.log(el.start);}); },
			onCompleted: () => { session.close(); process.exit(); }
		});
}

function main() {

		// todo: async.waterfall. sigh
//		count(function() {
//			simpleQuery('MATCH (b:Book) RETURN COUNT(b)', function() {
//				simpleQuery('MATCH (a:Author) RETURN COUNT(a)', process.exit);
//			});
//		});
	simpleQuery('MATCH (b:Book {Price: 0.99}) RETURN b', process.exit);
}

main();
