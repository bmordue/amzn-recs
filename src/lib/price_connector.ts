import needle from "needle";
import * as config from "./config";
import { CallbackFn } from "./crawl_queue";
import * as log from "./log";

export function fetch(asin: string, callback: CallbackFn) {
  const apiEndpoint = config.get("PRICE_LOOKUP_ENDPOINT");
  const reqUrl = `${apiEndpoint}?asin=${asin}`;
  const options = {
    proxy: null,
  };

  needle.get(reqUrl, options, (err, result) => {
    if (err) {
      log.error({ url: reqUrl, error: err }, "Error in price-for-asin.fetch()");
      return callback(err);
    }
    if (result.statusCode != 200) {
      return callback(new Error(`Expected HTTP 200; got ${result.statusCode}`));
    }
    if (!result.body) {
      return callback(new Error("No response body"));
    }
    callback(null, result.body);
  });
}
