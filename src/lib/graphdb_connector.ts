import async = require("async");
import config = require("./config");
import log = require("./log");
import neo4j = require("neo4j-driver");
import StatsD = require("node-statsd");

const statsd = new StatsD({
	prefix: 'amzn-recs.graphdb_connector.',
	host: process.env.STATSD_HOST || 'localhost'
});

function closeAndCallback(callback, session, err = null, result = null) {
	log.debug(null, "closeAndCallback");
	if (err) {
		log.error(null, err);
		statsd.increment('query_error');
	} else {
		statsd.increment('query_complete');
	}
	if (typeof callback != 'function') {
		log.error(new Error().stack, 'closeAndCallback: callback is not a function');
	}
	session.close().then(() => callback(err, result));
}

function createChildBookNode(driver, data, callback) {
	const query = buildMergeWithPriceQuery(data);
	const session = driver.session();

	if (!query.params) {
		log.warn(query, 'Empty params object');
	}

	const text = query.text;
	session.run(text, query.params)
		.subscribe({
			onNext: () => { },
			onCompleted: function () {
				return closeAndCallback(callback, session);
			},
			onError: (err) => {
				log.debug(query, 'failed query');
				log.debug({}, err);
				return closeAndCallback(callback, session, err);
			}
		});
}

function buildMergeWithPriceQuery(data) {
	let mergeQueryStr;

	const mergeQueryChunks = [];
	mergeQueryChunks.push("MERGE (b:Book { ASIN: $ASIN })");

	const mergeParams = {
		ASIN: data.ASIN,
		Title: null,
		Author: null,
		Price: null,
		Currency: null
	};
	if (data.ItemAttributes && data.ItemAttributes.Title && data.ItemAttributes.Author) {
		mergeParams.Title = data.ItemAttributes.Title;
		mergeParams.Author = data.ItemAttributes.Author;
		mergeQueryChunks.push("SET b.Title = $Title, b.Author = $Author");
	}
	if (data.price && data.currency) {
		mergeQueryChunks.push("SET b.Price = $Price, b.Currency = $Currency");
		mergeParams.Price = data.price;
		mergeParams.Currency = data.currency;
	}
	if (data.ItemAttributes && data.ItemAttributes.ListPrice) {
		mergeQueryChunks.push("SET b.Price = $Price, b.Currency = $Currency");
		mergeParams.Price = data.ItemAttributes.ListPrice.Amount / 100;
		mergeParams.Currency = data.ItemAttributes.ListPrice.CurrencyCode;
	}

	mergeQueryChunks.push("RETURN b");
	mergeQueryStr = mergeQueryChunks.join(" ");

	return { text: mergeQueryStr, params: mergeParams };
}

function addParentChildRelation(driver, parentAsin, childAsin, callback) {
	const queryStr = "MATCH (parent:Book {ASIN: $parentAsin}),(child:Book {ASIN: $childAsin}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r";
	const params = {
		parentAsin: parentAsin,
		childAsin: childAsin
	};

	const session = driver.session();

	session.run(queryStr, params)
		.subscribe({
			onNext: () => { },
			onCompleted: function (summary) {
				closeAndCallback(callback, session, null, summary);
			},
			onError: function (err) { closeAndCallback(callback, session, err); }
		});
}

function addAuthorRelations(driver, data, callback) {
	if (!data.ItemAttributes || !data.ItemAttributes.Author) {
		return callback(null, {});
	}
	let authorList = data.ItemAttributes.Author;
	if (authorList.constructor !== Array) {
		authorList = [authorList];
	}
	const session = driver.session();
	async.each(authorList, function (author, each_cb) {
		const queryStr =
			"MATCH (b:Book {ASIN: $childAsin})" +
			" MERGE (a:Author {name: $author})" +
			" MERGE (b)<-[:AUTHOR_OF]-(a)";
		const params = {
			childAsin: data.ASIN,
			author: author
		};
		session.run(queryStr, params)
			.subscribe({
				onNext: () => { },
				onCompleted: function () { each_cb(); },
				onError: each_cb
			}
			);
	}, function (err, result) {
		closeAndCallback(callback, session, err, result);
	});
}

function simpleQuery(connector, query, callback) {
	const session = connector.driver.session();

	const records = [];
	session.run(query.text, query.parameters)
		.subscribe({
			onNext: function (record) {
				records.push(record);
			},
			onCompleted: function () {
				closeAndCallback(callback, session, null, records);
			},
			onError: function (err) { closeAndCallback(callback, session, err); }
		});
}

function simpleQueryForAsin(connector, text, asin, callback) {
	const query = {
		text: text,
		parameters: { ASIN: asin }
	};
	simpleQuery(connector, query, callback);
}

export class DbConnector {
	//TODO: review result passed to callback for each function
	// if they're always [], is there any point...?
	options;
	driver :neo4j.Driver;

	constructor(options = {}) {
		this.options = options;
		//	const dbUrl = config.get("DB_URL") || "bolt://graphdb:7687";
		//	const dbUsername = config.get("DB_USERNAME");
		//	const dbPassword = config.get("DB_PASSWORD");

		const dbUrl = 'bolt://192.168.0.48:7687';
		const dbUsername = 'neo4j';
		const dbPassword = 'tester';

		//	const auth = dbUsername && dbPassword ? neo4j.auth.basic(dbUsername, dbPassword) : {};
		const auth = neo4j.auth.basic(dbUsername, dbPassword);
		this.driver = neo4j.driver(dbUrl, auth, { disableLosslessIntegers: true });
	}

	run(query: string, parameters, callback: Function) {
		const session = this.driver.session();
		let records = [];
		session.run(query, parameters).subscribe({
			onNext: (nextRecord) => { records.push([nextRecord]); },
			onError: (err) => { return closeAndCallback(callback, session, err); },
			onCompleted: () => { return closeAndCallback(callback, session, null, records); }
		})
	}


	init(callback) {
		const session = this.driver.session();

		session.run('CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE')
			.subscribe({
				onNext: () => { },
				onCompleted: function () {
					session.run('CREATE CONSTRAINT ON (author:Author) ASSERT author.name IS UNIQUE')
						.subscribe({
							onCompleted: function (summary) { closeAndCallback(callback, session, null, summary); },
							onError: function (err) { closeAndCallback(callback, session, err); }
						});
				},
				onError: function (err) { closeAndCallback(callback, session, err); }
			});
	}






	// TODO: what is the purpose of newNodeResult?
	createChildBookNodeAndRelations = function (parentAsin, data, callback) {
		const self = this;
		const newNodeResult = [];
		async.waterfall([
			function (cb) {
				createChildBookNode(self.driver, data, cb);
			},
			function (result, cb) {
				addParentChildRelation(self.driver, parentAsin, data.ASIN, cb);
			},
			function (result, cb) {
				addAuthorRelations(self.driver, data, cb);
			}
		],
			function (err) {
				return callback(err, newNodeResult);
			});
	};

	// TODO: createBookNode and createChildBookNode seem too similar; remove one
	createBookNode = function (data, callback) {
		log.debug(null, "DbConnector.createBookNode");
		if (data.ItemAttributes.ProductGroup != "eBooks") {
			log.warn(data, "Expected ItemAttributes.ProductGroup to be eBooks");
		}
		const query = buildMergeWithPriceQuery(data);
		const session = this.driver.session();
		log.debug(query, "Query: ");
		const records = [];

		session.run(query.text, query.params)
			.subscribe({
				onNext: (nextRecord) => { log.debug(nextRecord, "onNext"); records.push(nextRecord); },
				onCompleted: function () { log.debug(null, "onCompleted"); closeAndCallback(callback, session, null, records[0]?.get('b')); },
				onError: function (err) { log.debug({ err: err, query: query }, "onError: "); closeAndCallback(callback, session, err); }
			});
	};




	getBookNode = function (asin, callback) {
		const text = "MATCH (n { ASIN: $ASIN }) RETURN n";
		simpleQueryForAsin(this, text, asin, function(err, res: Array<neo4j.Record>) {
			callback(err, res[0]?.get('n'));
		});
	};

	deleteBookNode = function (asin, callback) {
		const text = "MATCH (n { ASIN: $ASIN }) DETACH DELETE n RETURN COUNT(n)";
		simpleQueryForAsin(this, text, asin, function(err, res) {
			const key = "COUNT(n)";
			callback(err, res[0]?.get(key));
		});
	};

	countOutgoingRecommendations = function (asin, callback) {
		const query = {
			text: "MATCH (n { ASIN: $ASIN })-[r]->() RETURN COUNT(DISTINCT r) AS outgoing",
			params: { ASIN: asin }
		};
		const session = this.driver.session();

		session.run(query)
			.subscribe({
				onNext: function (result) {
					log.debug({ result: result }, 'outgoing relationships');
				},
				onCompleted: function (summary) {
					closeAndCallback(callback, session, null, summary);
				},
				onError: function (err) { closeAndCallback(callback, session, err); }
			});
	};

	listAllAsins = function (callback) {
		const query = {
			text: "MATCH (n:Book) RETURN n.ASIN AS asin",
			params: {}
		};
		simpleQuery(this, query, function (err, summary) {
			callback(err, summary);
		});
	}

	listLeafNodeAsins = function (callback) {
		const query = {
			text: "MATCH (n) WHERE NOT (n)-->() RETURN n.ASIN as asin;",
			params: {}
		};
		simpleQuery(this, query, function (err, summary) {
			callback(err, summary);
		});
	}

	close = function () {
		this.driver.close();
	}

	getPath = function (startAsin, finishAsin, callback) {
		const query = {
			text: "MATCH p=((a:Book {ASIN: $start}) -[*1..10]-> (b:Book {ASIN: $finish})) RETURN p LIMIT 1;",
			parameters: {
				start: startAsin,
				finish: finishAsin
			}
		};
		simpleQuery(this, query, callback);
	}

	count = function (callback) {
		simpleQuery(this, { text: "MATCH (n) RETURN COUNT(n)" }, callback);
	}

}
