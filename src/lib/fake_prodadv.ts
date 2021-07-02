
import config = require('./config');
import log = require('./log');
import needle = require('needle');
import fs = require('fs');
import cheerio = require('cheerio');
import StatsD = require('node-statsd');

const statsd = new StatsD({
	prefix: 'amzn_recs.fake_prodadv.',
	host: config.get('STATSD_HOST')
});

let workOffline = process.env.OFFLINE?.toLowerCase() === 'true';

interface Parameters {
	ItemId: string,
	Author?: string
}

export function fakeProdAdv(query: string, params: Parameters, callback: Function) {

	log.debug({query: query, params: params}, 'Query using fake prodadv');

	const asin = params.ItemId;
	if (!asin) {
		log.warn({}, 'No ItemId in parameters');
	}

	switch (query) {
		case 'SimilarityLookup':
			return similarityLookup(asin, callback);
		case 'ItemSearch':
			return itemSearch(asin, params, callback);
		case 'ItemLookup':
			return itemLookup(asin, callback);
		default:
			return callback(new Error('Unrecognised query term: ' + query));
	}
}

function similarityLookup(asin: string, callback: Function) {
	const filename = config.get('HTML_DUMP_DIR') + asin + '_dump.html';
	if (fs.existsSync(filename)) {
		log.debug(filename, 'using cached file for similarity lookup');
		const data = fs.readFileSync(filename);
		return processDataForSimilarityLookup(data, callback);
	} else if (!workOffline) {
		log.debug(asin, 'making amzn request for similarity lookup');
		amznRequest(asin, function(err, respBody) {
			if (err) { return callback(err); }
			return processDataForSimilarityLookup(respBody, callback);
		});
	} else {
		log.debug(asin, 'skipping similarity lookup');
		return callback(null, {Items: {Item: []}});
	}
}

function processDataForSimilarityLookup(data, callback: Function) {
		const $ = cheerio.load(data);
		let items = [];
		const carouselElement = $('div.similarities-aui-carousel')
		if (!carouselElement) {
			log.info({}, 'did not manage to find similar items carousel in page');
			return callback(null, {});
		}
		const carouselOptions = carouselElement.attr('data-a-carousel-options');
		if (!carouselOptions) {
			log.info({}, 'did not manage to find expected attribute on similar items carousel');
			return callback(null, {});
		}
		let carousel;
		try {
			carousel = JSON.parse(carouselOptions.replace('\"', '"'));
		} catch (e) {
			log.debug(carouselOptions, 'carouselOptions');
			return callback(null, {'Items': {'Item': items}});
		}
		const almostAsins = carousel.ajax.id_list;
		if (!almostAsins) {
			log.info(carousel, 'did not manage to extract ASINs from carousel data');
			return callback(null, {});
		}
		items = almostAsins.map(function(i) { return { 'ASIN': i.substring(0, i.length - 1), 'ItemAttributes': {} } }); // strip trailing colon from asins
		log.debug(items.length, 'found similar items');

		callback(null, {'Items': {'Item': items}});
}

function itemSearch(asin: string, params: Parameters, callback: Function) {
//	log.warn(asin, 'skipped itemSearch(), not yet implemented');
//	return callback(new Error('Not yet implemented'));
	itemLookup(params.Author, callback);
}

function itemLookup(asin: string, callback: Function) {
	const filename = config.get('HTML_DUMP_DIR') + asin + '_dump.html';
	if (fs.existsSync(filename)) {
		log.debug(filename, 'using cached file for item lookup');
		const data = fs.readFileSync(filename);
		return processDataForItemLookup(asin, data, callback);
	} else if (!workOffline) {
		log.debug(asin, 'making amzn request for item lookup');
		amznRequest(asin, function(err, respBody) {
			if (err) { return callback(err); }
			return processDataForItemLookup(asin, respBody, callback);
		});
	} else {
		log.debug(asin, 'skipping item lookup');
		return callback(null, {Items: {Item: []}});
	}
}

function concatWithSpacedComma(arr: Array<string>) :string {
	return arr.join(', ');
}

function buildDetailPageUrl(asin: string): string {
	return config.get('AMZN_ENDPOINT') + asin;
}

function processDataForItemLookup(asin: string, data, callback: Function) {
	const result = {
		Items: {
			Item: {
				ASIN: '',
				DetailPageUrl: '',
				ItemAttributes: {
					Title: '',
					Author: '',
					ListPrice: {
						Amount: 0,
						CurrencyCode: 'GBP'
					}
				}
			}
		}
	};

	const $ = cheerio.load(data);

	const title = $('#ebooksProductTitle').text();
	result.Items.Item.ItemAttributes.Title = title;

	const currencyCode = $('#buyOneClick input[name="displayedCurrencyCode"]').attr('value');
	result.Items.Item.ItemAttributes.ListPrice.CurrencyCode = currencyCode;

	const price = $('#buyOneClick input[name="displayedPrice"]').attr('value');
	result.Items.Item.ItemAttributes.ListPrice.Amount = price * 100;

	const authors = [];
	$('a[data-asin]').each(function(ie, el) {
		authors.push(($(el).text()));
	});
	log.debug({authors: authors}, 'authors');
	result.Items.Item.ItemAttributes.Author = concatWithSpacedComma(authors);

	result.Items.Item.DetailPageUrl = buildDetailPageUrl(asin);
	result.Items.Item.ASIN = asin;

	return callback(null, result);
}

function amznRequest(asin: string, callback: Function) {
	// https://www.amazon.co.uk/gp/product/B003GK21A8
	const reqUrl = buildDetailPageUrl(asin);
	const options = {
		proxy: null
	};

	needle.get(reqUrl, options, function(err, result) {
		if (err) {
			return callback(err);
		}
		statsd.increment(result.statusCode);
		if (result.statusCode == 503) {
			log.warn({}, 'Going offline; fake_prodadv will stop making requests to amzn');
			workOffline = true;
		}
		if (result.statusCode != 200) {
			log.error({}, 'Response code is ' + result.statusCode);
			return callback({code: result.statusCode, message: 'amzn request failed'});
		}
		if (!result.body) {
			return callback(new Error('No response body'));
		}

		const filename = config.get('HTML_DUMP_DIR') + asin + '_dump.html';
		fs.writeFileSync(filename, result.body);

		callback(null, result.body);
	});
}
