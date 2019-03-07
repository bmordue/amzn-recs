
var log = require('./log');
var needle = require('needle');
var fs = require('fs');
var cheerio = require('cheerio');

const api_endpoint = process.env.AMZN_ENDPOINT || 'https://www.amazon.co.uk/gp/product/';


module.exports = function(query, params, callback) {

	log.debug({query: query, params: params}, 'Query using fake prodadv');

	var asin = params.ItemId;
	if (!asin) {
		return callback(new Error('Missing ItemId in parameters'));
	}

	switch (query) {
		case 'SimilarityLookup':
			return similarityLookup(asin, callback);
		case 'ItemSearch':
			return itemSearch(asin, callback);
		case 'ItemLookup':
			return itemLookup(asin, callback);
		default:
			return callback(new Error('Unrecognised query term: ' + query));
	}
}

function similarityLookup(asin, callback) {
	var filename = asin + '_dump.html';
	if (fs.existsSync(filename)) {
		log.debug(filename, 'using cached file for similarity lookup');
		var data = fs.readFileSync(filename);
		return processDataForSimilarityLookup(data, callback);
	} else if (!process.env.OFFLINE) {
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

function processDataForSimilarityLookup(data, callback) {
		const $ = cheerio.load(data);
		var carouselElement = $('div.similarities-aui-carousel')
		if (!carouselElement) {
			log.info({}, 'did not manage to find similar items carousel in page');
			return callback(null, {});
		}
		var carouselOptions = carouselElement.attr('data-a-carousel-options');
		if (!carouselOptions) {
			log.warn({}, 'did not manage to find expected attribute on similar items carousel');
			return callback(null, {});
		}
		var carousel = JSON.parse(carouselOptions.replace('\"', '"'));
		var almostAsins = carousel.ajax.id_list;
		if (!almostAsins) {
			log.warn(carousel, 'did not manage to extract ASINs from carousel data');
			return callback(null, {});
		}
		var items = almostAsins.map(function(i) { return { 'ASIN': i.substring(0, i.length - 1), 'ItemAttributes': {} } }); // strip trailing colon from asins
		log.debug(items.length, 'found similar items');

		callback(null, {'Items': {'Item': items}});
}

function itemSearch(asin, callback) {
	log.warn(asin, 'skipped itemSearch(), not yet implemented');
	return callback(new Error('Not yet implemented'));
}

function itemLookup(asin, callback) {
	var filename = asin + '_dump.html';
	if (fs.existsSync(filename)) {
		log.debug(filename, 'using cached file for item lookup');
		var data = fs.readFileSync(filename);
		return processDataForItemLookup(asin, data, callback);
	} else if (!process.env.OFFLINE) {
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

function processDataForItemLookup(asin, data, callback) {
	var result = {
		Items: {
			Item: {
				ASIN: 0,
				DetailPageURL: '',
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

	var title = $('#ebooksProductTitle').text();
	result.Items.Item.ItemAttributes.Title = title;

	var currencyCode = $('#buyOneClick input[name="displayedCurrencyCode"]').attr('value');
	result.Items.Item.ItemAttributes.ListPrice.CurrencyCode = currencyCode;

	var price = $('#buyOneClick input[name="displayedPrice"]').attr('value');
	result.Items.Item.ItemAttributes.ListPrice.Amount = price * 100;

	var authors = [];
	$('a[data-asin]').each(function(ie, el) {
		authors.push(($(el).text()));
	});
	log.debug({authors: authors}, 'authors');
	result.Items.Item.ItemAttributes.Author = authors;

	result.Items.Item.DetailPageUrl = api_endpoint + asin;
	result.Items.Item.ASIN = asin;

	return callback(null, result);
}

function amznRequest(asin, callback) {
	// https://www.amazon.co.uk/gp/product/B003GK21A8
	var reqUrl = api_endpoint + asin;
	var options = {};
	options.proxy = null; // Or eg 'http://localhost:8888'

	needle.get(reqUrl, options, function(err, result) {
		if (err) {
			return callback(err);
		}
		if (result.statusCode != 200) {
			log.error({}, 'Response code is ' + result.statusCode);
			return callback({code: result.statusCode, message: 'amzn request failed'});
		}
		if (!result.body) {
			return callback(new Error('No response body'));
		}

		var filename = asin + '_dump.html';
		fs.writeFileSync(filename, result.body);

		callback(null, result.body);
	});
}
