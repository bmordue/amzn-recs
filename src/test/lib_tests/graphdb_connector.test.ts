import fs = require('fs');
import path = require('path');
import should = require('should');
import util = require('util');
import { Record, Node, Neo4jError } from 'neo4j-driver';
import test_utils = require('../test_utils');
import { DbConnector } from '../../lib/graphdb_connector';

const LOG_ALL = false;

describe('DbConnector', function () {
  console.log('RUN_UNSAFE_TESTS is not set to true; exiting');
  return;
  this.timeout(10000);

  const dbConnector = new DbConnector();

  const bookData = {
    ASIN: 'B014V4DXMW-testdata',
    DetailPageURL: 'http://amzn.co/B014V4DXMW',
    ItemAttributes: {
      Author: 'China Mi\u00e9ville',
      Manufacturer: 'Picador',
      ProductGroup: 'eBooks',
      Title: 'This Census-Taker',
    },
  };

  const childBookData = {
    ASIN: 'B01CDMP88Q-testdata',
    DetailPageURL: 'http://amzn.co/B01CDMP88Q',
    ItemAttributes: {
      Author: 'Zen Cho',
      ProductGroup: 'eBooks',
      Title: 'The Terracotta Bride',
    },
  };

  const logAllNodes = function (callback) {
    if (!LOG_ALL) {
      return callback();
    }
    console.log('====== log all nodes for info');
    dbConnector.run('MATCH (n) RETURN n', null, (err, result) => {
      console.log(util.inspect(result, { depth: null, colors: true }));
      console.log('------');
      callback(err);
    });
  };

  before((done) => {
    console.log('Detach-delete all existing nodes');
    dbConnector.run('MATCH (n) DETACH DELETE n', null, done);
  });

  // it("get DB service root", function(done) {
  //   dbConnector.db.http({ method: "GET", path: "/db/data/", raw: true }, function(err, result) {
  //     if (err) {
  //       return done(err);
  //     }
  //     result.statusCode.should.equal(200);
  //     return done();
  //   });
  // });

  it('create a Book node', (done) => {
    dbConnector.createBookNode(bookData, (err, bookNode: Node) => {
      if (err) {
        console.log('returning error from createBookNode()');
        return done(err);
      }
      if (!bookNode) {
        return done(new Error('No book node provided in createBookNode() callback'));
      }
      try {
        bookNode.properties.ASIN.should.equal(bookData.ASIN);
      } catch (e) {
        return done(e);
      }
      done();
    });
  });

  it('create an identical Book node should not return an error', (done) => {
    dbConnector.createBookNode(bookData, (err, bookNode: Node) => {
      if (err) {
        return done(err);
      }
      try {
        bookNode.properties.ASIN.should.equal(bookData.ASIN);
      } catch (e) {
        return done(e);
      }
      done();
    });
  });

  it('get a Book node by ASIN', (done) => {
    dbConnector.getBookNode(bookData.ASIN, (err, bookNode: Node) => {
      if (err) {
        return done(err);
      }
      bookNode.properties.ASIN.should.equal(bookData.ASIN);
      done();
    });
  });

  it('getting a Book node by ASIN that does not exist returns an empty result', (done) => {
    dbConnector.getBookNode('rubbish_ASIN', (err, result) => {
      if (err) {
        return done(err);
      }
      should(result).be.null;
      done();
    });
  });

  it('deleting a Book node by ASIN returns delete count 1', (done) => {
    dbConnector.deleteBookNode(bookData.ASIN, (err, count: number) => {
      if (err) {
        return done(err);
      }
      count.should.eql(1);
      done();
    });
  });

  it('deleting a Book node using an ASIN that does not exist returns delete count 0', (done) => {
    dbConnector.deleteBookNode('rubbish_ASIN', (err, result) => {
      if (err) {
        return done(err);
      }
      result.should.eql(0);
      done();
    });
  });

  it('inserting a Book node as a child of another Book node that does not exist creates the child with no relationship', (done) => {
    dbConnector.createChildBookNodeAndRelations('rubbish_ASIN', childBookData, (err) => {
      if (err) {
        return done(err);
      }
      test_utils.checkOnlyOneNodeMatchesAsin(dbConnector, { asin: childBookData.ASIN }, (err) => { // new "child" node exists
        if (err) {
          return done(err);
        }
        dbConnector.run(
          'MATCH (n {ASIN: $asin})-[r:SIMILAR_TO]-() RETURN r',
          { asin: childBookData.ASIN },
          (err, result) => {
            if (err) return done(err);
            if (!result) return done(new Error('Expected result to be present (truthy)'));
            result.should.eql([]); // but there is no SIMILAR_TO relationship
            done();
          },
        );
      });
    });
  });

  it('insert a Book node as a child of another Book node', (done) => {
    dbConnector.createBookNode(bookData, (err) => {
      if (err) {
        return done(err);
      }
      dbConnector.createChildBookNodeAndRelations(bookData.ASIN, childBookData, (err) => {
        if (err) {
          return done(err);
        }
        dbConnector.run(
          'MATCH ({ ASIN: $parentAsin })-[r:SIMILAR_TO]->({ ASIN: $childAsin }) RETURN r',
          {
            parentAsin: bookData.ASIN,
            childAsin: childBookData.ASIN,
          },
          (err, result) => {
            if (err) {
              return done(err);
            }
            if (!result) {
              return done(new Error('expected result to be present (truthy)'));
            }
            try {
              const record: Record = result[0];
              const rel: Node = record[0];
              should.exist(rel);
            } catch (error) {
              return done(error);
            }
            done();
          },
        );
      });
    });
  });

  afterEach(logAllNodes);

  // after(function(done) {
  //   const deleteQuery = "MATCH (n {ASIN: {asin}}) DETACH DELETE n";
  //   dbConnector.run({query: deleteQuery, params: { asin: bookData.ASIN}}, function(err, result) {
  //     if (err) {
  //       console.log(err);
  //     }
  //     dbConnector.run({query: deleteQuery, params: { asin: childBookData.ASIN}}, function(err, result) {
  //       if (err) {
  //         console.log(err);
  //       }
  //       logAllNodes(done);
  //     });
  //   });
  // });
});
