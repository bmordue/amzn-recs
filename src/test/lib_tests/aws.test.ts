import * as should from "should";
import { createProdAdvClient, hmacSha256 } from "../../lib/aws";

describe("fake_aws", function () {
  this.timeout(10000);

  it("createProdAdvClient", () => {
    const client = createProdAdvClient();
    should.exist(client);
  });

  it("hmacSha256", () => {
    hmacSha256("sooperseekrit", "my confidential message").should.eql(
      "tZBLhzNb9yK5/+30iPYd1WAiL8PxaPjqsPLGffCDCvo="
    );
  });
});
