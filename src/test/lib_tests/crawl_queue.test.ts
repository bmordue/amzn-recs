import { CrawlQueue } from "../../lib/crawl_queue";

describe("crawl queue", () => {
  it("should exist", () => {
    const cq = new CrawlQueue({});
    expect(cq).not.toBeNull();
  });
});
