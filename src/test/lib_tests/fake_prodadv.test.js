require("dotenv").load({silent: true});
var DbConnector = require("../../lib/graphdb_connector");
var fs = require("fs");
var path = require("path");
var should = require("should");
var test_utils = require("../test_utils");
var util = require("util");

var LOG_ALL = false;

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
});
