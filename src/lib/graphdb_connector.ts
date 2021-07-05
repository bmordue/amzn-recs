import async = require("async");
import config = require("./config");
import log = require("./log");
import neo4j = require("neo4j-driver");
import StatsD = require("node-statsd");

const statsd = new StatsD({
	prefix: 'amzn-recs.graphdb_connector.',
	host: config.get('STATSD_HOST')
});

function closeAndCallback(callback, session, err = null, result = null) {
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

async function createChildBookNode(driver: neo4j.Driver, data, callback: Function) {
	const query = buildMergeWithPriceQuery(data);

	if (!query.params) {
		log.warn(query, 'Empty params object');
	}

	let err = null;
	const session = driver.session();
	try {
		await session.writeTransaction((tx) => tx.run(query.text, query.params));
	} catch(e) {
		err = e;
	} finally {
		await session.close();
		callback(err);
	}
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

async function addParentChildRelation(driver: neo4j.Driver, parentAsin: string, childAsin: string, callback: Function) {
	const queryStr = "MATCH (parent:Book {ASIN: $parentAsin}),(child:Book {ASIN: $childAsin}) MERGE (parent)-[r:SIMILAR_TO]->(child) RETURN r";
	const params = {
		parentAsin: parentAsin,
		childAsin: childAsin
	};

	const session = driver.session();
	let err = null;
	let result = null;
	try {
		result = await session.writeTransaction((tx) => tx.run(queryStr, params));
	} catch (error) {
		err = error
	} finally {
		await session.close();
		callback(err, result);
	}
}

function addAuthorRelations(driver: neo4j.Driver, data, callback) {
	if (!data.ItemAttributes || !data.ItemAttributes.Author) {
		return callback(null, {});
	}
	let authorList = data.ItemAttributes.Author;
	if (authorList.constructor !== Array) {
		authorList = [authorList];
	}
	const queryStr =
		"MATCH (b:Book {ASIN: $childAsin})" +
		" MERGE (a:Author {name: $author})" +
		" MERGE (b)<-[:AUTHOR_OF]-(a)";
	async.each(authorList, async function (author, each_cb) {
		const params = {
			childAsin: data.ASIN,
			author: author
		};
		let err = null;
		const session = driver.session();
		try {
			await session.writeTransaction((tx) => { tx.run(queryStr, params) });
		} catch (e) {
			err = e;
		} finally {
			await session.close();
			each_cb(err);
		}
	}, callback);
}

async function simpleQuery(connector: DbConnector, query: {text: string, parameters?: object}, callback) {
	const session = connector.driver.session();

	let records = null;
	let err = null;
	try {
		const result = await session.writeTransaction((tx) => tx.run(query.text, query.parameters));
		records = result.records;
	} catch (e) {
		err = e;
	} finally {
		await session.close();
		callback(err, records);
	}
}

function simpleQueryForAsin(connector, text: string, asin: string, callback: Function) {
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
		log.warn({}, "DbConnector.run() should only be used for testing and ad-hoc scripts");
		const session = this.driver.session();
		let records = [];
		session.run(query, parameters).subscribe({
			onNext: (nextRecord) => { records.push([nextRecord]); },
			onError: (err) => { return closeAndCallback(callback, session, err); },
			onCompleted: () => { return closeAndCallback(callback, session, null, records); }
		})
	}


	async init(callback) {
		const session = this.driver.session();
		const uniqueAsin = 'CREATE CONSTRAINT ON (book:Book) ASSERT book.ASIN IS UNIQUE';
		const uniqueAuthor = 'CREATE CONSTRAINT ON (author:Author) ASSERT author.name IS UNIQUE';
		let err = null;
		try {
			await session.writeTransaction((tx) => tx.run(uniqueAsin));
			await session.writeTransaction((tx) => tx.run(uniqueAuthor));
		} catch (error) {
			err = error;
		} finally {
			session.close();
			callback(err);
		}
	}






	createChildBookNodeAndRelations = function (parentAsin, data, callback) {
		const self = this;
		const newNodeResult = [];
		async.waterfall([
			function (cb) {
				createChildBookNode(self.driver, data, cb);
			},
			function (cb) {
				addParentChildRelation(self.driver, parentAsin, data.ASIN, cb);
			},
			function (result, cb) {
				addAuthorRelations(self.driver, data, cb);
			}
		], callback);
	};

	// TODO: createBookNode and createChildBookNode seem too similar; remove one
	async createBookNode (data, callback) {
		if (data.ItemAttributes.ProductGroup != "eBooks") {
			log.warn(data, "Expected ItemAttributes.ProductGroup to be eBooks");
		}
		const query = buildMergeWithPriceQuery(data);
		const session: neo4j.Session = this.driver.session();
		log.debug(query, "DbConnector.createBookNode query: ");
		let createdNode;
		let err;
		try {
			const result = await session.writeTransaction((tx) => tx.run(query.text, query.params));
			createdNode = result.records[0]?.get('b');
		} catch (error) {
			err = error;
		} finally {
			callback(err, createdNode);
		}
	};




	getBookNode = function (asin, callback) {
		const text = "MATCH (n { ASIN: $ASIN }) RETURN n";
		simpleQueryForAsin(this, text, asin, function(err, res: Array<neo4j.Record>) {
			callback(err, res[0]?.get('n'));
		});
	};

	deleteBookNode = function (asin, callback) {
		const queryStr = "MATCH (n { ASIN: $ASIN }) DETACH DELETE n RETURN COUNT(n)";
		simpleQueryForAsin(this, queryStr, asin, function(err, res) {
			const key = "COUNT(n)";
			callback(err, res[0]?.get(key));
		});
	};

	countOutgoingRecommendations = function (asin, callback) {
		const queryStr = "MATCH (n { ASIN: $ASIN })-[r]->() RETURN COUNT(DISTINCT r) AS outgoing";
		const session = this.driver.session();
		simpleQueryForAsin(this, queryStr, asin, callback);
	};

	listAllAsins = function (callback) {
		const query = {
			text: "MATCH (n:Book) RETURN n.ASIN AS asin"
		};
		simpleQuery(this, query, function (err, summary) {
			callback(err, summary);
		});
	}

	listLeafNodeAsins = function (callback) {
		const query = {
			text: "MATCH (n) WHERE NOT (n)-->() RETURN n.ASIN as asin;"
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
