// count nodes in the graph
//var MessageQueue = require("../lib/message_queue");
var DbConnector = require('../lib/graphdb_connector');
var neo4j = require('neo4j-driver');
const util = require('util');

function simpleQuery(queryStr, callback) {

//	var driver = neo4j.driver('neo4j://192.168.0.48:7474', neo4j.auth.basic('neo4j', 'tester'));
	var driver = neo4j.driver('bolt://192.168.0.48:7687', neo4j.auth.basic('neo4j', 'tester'));
//	var driver = neo4j.driver('neo4j://localhost', neo4j.auth.basic('neo4j', 'tester'));
	var session = driver.session();

	session.run(queryStr)
		.subscribe({
			onError: (err) => { console.log(err); session.close(); return callback(err); },
			onNext: (record) => { console.log(util.inspect(record, {compact: false, depth: 5})); },
			onCompleted: () => { console.log('Finished ' + queryStr); session.close(); return callback(); }
		});
}

function count(callback) {
	simpleQuery('MATCH () RETURN COUNT(*) AS count', callback);
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
	simpleQuery('MERGE (b:Book { ASIN: "B019CSNQ24" }) SET b.Title = "The Nightmare Stacks: A Laundry Files novel", b.Author = "Charles Stross" RETURN b', function() {
		simpleQuery("match () return count(*) as count", process.exit);
	});
}

function check() {
	var driver = neo4j.driver('bolt://192.168.0.48:7687', neo4j.auth.basic('neo4j', 'tester'));
	driver.verifyConnectivity().then(process.exit);
}


check();

//main();
