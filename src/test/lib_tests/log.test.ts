import * as log from "../../lib/log";

describe("logger", () => {
  const levels = ["error", "warn", "info", "debug"];
  levels.forEach((level) => {
    it(`should log at level ${level}`, () => {
      log[level]({ details: "none" }, `Logging at level ${level}`);
    });
  });
});
