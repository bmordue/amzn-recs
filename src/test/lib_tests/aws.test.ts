import { createProdAdvClient, hmacSha256 } from "../../lib/aws";

describe("fake_aws", function () {
  it("createProdAdvClient", () => {
    const client = createProdAdvClient();
    expect(client).not.toBeNull();
  });

  it("hmacSha256", () => {
    expect(hmacSha256("sooperseekrit", "my confidential message")).toBe(
      "tZBLhzNb9yK5/+30iPYd1WAiL8PxaPjqsPLGffCDCvo="
    );
  });
});
