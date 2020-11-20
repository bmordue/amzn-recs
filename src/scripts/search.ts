// try different search responseGroups to find the one with the info we want
import { CrawlQueue } from "../lib/crawl_queue";
import log = require("../lib/log")
import { fakeProdAdv } from '../lib/fake_prodadv';

const responseGroups = [
	"Small",
	"Medium",
	"Large",
	"OfferFull",
	"OfferListings",
	"Offers",
	"OfferSummary",
	"PromotionSummary",
	"VariationOffers"
];

const main = function() {
	const maxDepth = process.argv[2] || 2;

	const rootAsin = 'B014V4DXMW'; //starting ASIN
	const crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
	const searchTerm = rootAsin;
	let searched = 0;
	responseGroups.forEach(function(responseGroup) {
//		crawler.keywordSearch(searchTerm, responseGroup,function(err, result) {
		fake_prodadv('ItemLookup', {ItemId: rootAsin}, function(err, result) {
			log.info(responseGroup, "RESPONSE GROUP");
			if (err) {
				log.error(err, "Error in scripts/search.js#main()");
				log.error(err.stack, "stack");
			}
			try {
				delete result.OperationRequest;
			} catch (e) {
				log.warn({}, "result.OperationRequest does not exist");
			}
			log.info(result, "search result: ");
			searched++;
			if (searched == responseGroups.length) {
				process.exit();
			}
		});
	});
};

main();
