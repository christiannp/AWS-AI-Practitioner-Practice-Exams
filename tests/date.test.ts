import { afterEach, describe, expect, it } from "vitest";

import { localDateKey } from "../src/domain/date";

const originalTimezone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimezone;
});

describe("local date key", () => {
  it("uses the learner's calendar date when UTC is already on the next day", () => {
    process.env.TZ = "America/Los_Angeles";

    expect(localDateKey(new Date("2026-07-30T06:30:00.000Z"))).toBe(
      "2026-07-29"
    );
  });

  it("zero-pads local month and day components", () => {
    process.env.TZ = "Asia/Taipei";

    expect(localDateKey(new Date("2026-01-02T04:00:00.000Z"))).toBe(
      "2026-01-02"
    );
  });
});
