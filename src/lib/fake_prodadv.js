
var log = require('./log');
var needle = require('needle');
var HtmlParser = require('node-html-parser');
var fs = require('fs');

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
	amznRequest(asin, function(err, respBody) {
		if (err) { return callback(err); }

		var filename = asin + '_dump.html';
		log.debug(filename, "dump response body to file");
		fs.writeFileSync(filename, respBody);

		// TODO make this more robust
		const root = HtmlParser.parse(respBody);
		var carouselElement = root.querySelector('div.similarities-aui-carousel')
		if (!carouselElement) {
			log.info({}, 'did not manage to find similar items carousel in page');
			return callback(null, {});
		}
		var carouselOptions = carouselElement.attributes['data-a-carousel-options'];
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

		callback(null, {'Items': {'Item': items}});
	});
}

function itemSearch(asin, callback) {
	amznRequest(asin, function(err, respBody) {
		if (err) { return calback(err); }
		callback(null, {});
	});
}

function itemLookup(asin, callback) {
	amznRequest(asin, function(err, respBody) {
		if (err) { return calback(err); }
		callback(null, {});
	});
}

function amznRequest(asin, callback) {
	// https://www.amazon.co.uk/gp/product/B003GK21A8
	var api_endpoint = process.env.AMZN_ENDPOINT || 'https://www.amazon.co.uk/gp/product/';
	var reqUrl = api_endpoint + asin;
	var options = {};
	options.proxy = null; // Or eg 'http://localhost:8888'

	needle.get(reqUrl, options, function(err, result) {
		if (err) {
			return callback(err);
		}
		if (result.statusCode != 200) {
//			var err = new Error('Response code is not HTTP 200');
//			log.debug(result.headers, 'Error response headers');
//			log.debug(result.body, 'Error response body');
			log.error({}, 'Response code is ' + result.statusCode);
			return callback({code: result.statusCode});
		}
		if (!result.body) {
			return callback(new Error('No response body'));
		}
		callback(null, result.body);
	});
}
