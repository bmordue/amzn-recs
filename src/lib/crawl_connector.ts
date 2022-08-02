import needle = require('needle');

const CRAWL_API_TOKEN = '222222';

export function add(task, callback) {
    const endpoint = process.env.CRAWL_API_ENDPOINT;
    const options = {
      json: true,
      headers: {
        'X-Api-Token': CRAWL_API_TOKEN,
      },
    };
    needle.request('post', endpoint, task, options, (err, result) => {
      if (err) {
        return callback(err);
      }
      let responseBody = '';
      result.on('data', (chunk) => {
        responseBody += chunk;
      });
      result.on('end', () => {
        if (!responseBody) {
          return callback(new Error('No response body'));
        }
        callback(null, responseBody);
      });
    });
}
