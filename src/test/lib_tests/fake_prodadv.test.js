require("dotenv").load({silent: true});
var should = require("should");
var fake_prodadv = require('../../lib/fake_prodadv');

describe("fake_prodadv", function() {
	this.timeout(10000);

	before(function(done) {
		done();
	});


	it("parse authors list", function(done) {
		var query = "ItemLookup";
		var params = { ItemId: "B0042AMD2M" };
		fake_prodadv(query, params, function(err, result) {
			if (err) { return done(err); }
			var authors = result.Items.Item.ItemAttributes.Author;
			authors.should.be.eql(["Blake Crouch","Jack Kilborn","F. Paul Wilson","Jeff Strand"]);
			done();
		});
	});

	it("load similar items list", function(done) {
		var query = "SimilarityLookup";
		var params = { ItemId: "B00EEIGHDI" };
		fake_prodadv(query, params, function(err, result) {
			if (err) { return done(err); }
			result.Items.Item.length.should.equal(93);
			done();
		});
	});
});
