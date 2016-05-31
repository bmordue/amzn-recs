// crawl prod adv API and write results to JSON files
var CrawlQueue = require("../lib/crawl_queue");
var log = require("../lib/log")
var util = require("util");

var responseGroups = [
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

var main = function() {
	var maxDepth = process.argv[2] || 2;
	
	var rootAsin = 'B014V4DXMW'; //starting ASIN
	var crawler = new CrawlQueue({maxCrawlDepth: maxDepth});
	var searchTerm = rootAsin;
	responseGroups.forEach(function(responseGroup) {
		crawler.keywordSearch(searchTerm, responseGroup,function(err, result) {
			log.info(responseGroup, "RESPONSE GROUP");
			if (err) {
				log.error(err, "Error");
				log.error(err.stack, "stack");
			}
			try {
				delete result.OperationRequest;
			} catch (e) {
				log.warn({}, "result.OperationRequest does not exist");
			}
			log.info(result, "search result: ");
		});
	});
};

main();
