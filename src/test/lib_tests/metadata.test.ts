import { readCredentials } from "../../lib/metadata";

describe("readCredentials", () => {
  it("should exist", () => {
    expect(readCredentials).not.toBeNull();
  });

  xit("should fail to connect to network", (done) => {
    readCredentials({}, (err) => {
      expect(err).not.toBeNull();
      done();
    });
  });
});
