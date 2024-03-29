export function checkOnlyOneNodeMatchesAsin(dbConnector, options, callback) {
  if (options.message) {
    console.log(options.message);
  }
  dbConnector.run('MATCH (n {ASIN: $asin}) RETURN n', { asin: options.asin }, (err, result) => {
    if (err) {
      return callback(err);
    }
    if (result.length != 1) {
      console.log(`result:\n${JSON.stringify(result, null, 2)}`);
      return callback(new Error(`Expected length of result to be 1, got ${result.length}`));
    }
    return callback();
  });
}
