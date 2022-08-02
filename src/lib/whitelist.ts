// stub implementation
export class Whitelist {
  constructor() {}

  add(token, callback) {
    callback();
  }

  check(token, callback) {
    callback(true);
  }
}
