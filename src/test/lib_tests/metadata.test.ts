import { readCredentials } from "../../lib/metadata";

describe("readCredentials", () => {
  it("should fail to connect to network", (done) => {
    readCredentials({}, (err) => {
      expect(err).not.toBeNull();
      done();
    });
  });
});
