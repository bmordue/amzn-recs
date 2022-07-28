const should = require('should');
const fake_prodadv = require('../../lib/fake_prodadv');

describe('fake_prodadv', function () {
  this.timeout(10000);

  before((done) => {
    done();
  });

  if (process.env.RUN_UNSAFE_TESTS == 'true') {
    it('parse authors list', (done) => {
      const query = 'ItemLookup';
      const params = { ItemId: 'B0042AMD2M' };
      fake_prodadv(query, params, (err, result) => {
        if (err) { return done(err); }
        const authors = result.Items.Item.ItemAttributes.Author;
        authors.should.be.eql(['Blake Crouch', 'Jack Kilborn', 'F. Paul Wilson', 'Jeff Strand']);
        done();
      });
    });

    it('load similar items list', (done) => {
      const query = 'SimilarityLookup';
      const params = { ItemId: 'B00EEIGHDI' };
      fake_prodadv(query, params, (err, result) => {
        if (err) { return done(err); }
        result.Items.Item.length.should.equal(94);
        done();
      });
    });
  }
});
