import { createProdAdvClient, hmacSha256 } from "../../lib/aws";

describe("fake_aws", function () {
  this.timeout(10000);

  it("createProdAdvClient", () => {
    const client = createProdAdvClient();
    should.exist(client);
  });

  it("hmacSha256", () => {
    expect(hmacSha256("sooperseekrit", "my confidential message")).toBe(
      "tZBLhzNb9yK5/+30iPYd1WAiL8PxaPjqsPLGffCDCvo="
    );
  });
});
