import { describe, expect, it } from "vitest";
import { dayKeyOf, isValidDayKey, last7Days, shiftDayKey } from "@/lib/date";
import { summarize, type Trip } from "@/lib/shift";

describe("summarize", () => {
  it("matches the example receipt from the task description", () => {
    const trips: Trip[] = [
      {
        id: "t1",
        start: "2026-10-01T08:10:00+05:00",
        end: "2026-10-01T08:32:00+05:00",
        amount: 2400,
        payment: "card",
        commission: 360,
      },
      {
        id: "t2",
        start: "2026-10-01T09:05:00+05:00",
        end: "2026-10-01T09:20:00+05:00",
        amount: 1500,
        payment: "cash",
        commission: 225,
      },
    ];

    expect(summarize(trips)).toEqual({
      count: 2,
      revenue: 3900,
      commission: 585,
      net: 3315,
      byPayment: { cash: 1500, card: 2400 },
    });
  });

  it("returns all zeros for a day with no trips", () => {
    expect(summarize([])).toEqual({
      count: 0,
      revenue: 0,
      commission: 0,
      net: 0,
      byPayment: { cash: 0, card: 0 },
    });
  });

  it("handles a day with only cash or only card trips", () => {
    const cashOnly: Trip[] = [
      {
        id: "a",
        start: "2026-10-01T08:00:00+05:00",
        end: "2026-10-01T08:10:00+05:00",
        amount: 500,
        payment: "cash",
        commission: 50,
      },
    ];
    expect(summarize(cashOnly).byPayment).toEqual({ cash: 500, card: 0 });
  });
});

describe("dayKeyOf", () => {
  it("extracts the calendar day straight from the offset timestamp", () => {
    expect(dayKeyOf("2026-10-01T08:10:00+05:00")).toBe("2026-10-01");
  });

  it("keeps a late-night local trip on its own day instead of rolling to UTC's next day", () => {
    // 23:50 local (+05:00) is already 18:50 UTC the same day, but the bug
    // this guards against is routing through `new Date(...).toISOString()`
    // first, which for some offsets would push the date across midnight.
    expect(dayKeyOf("2026-10-01T23:50:00+05:00")).toBe("2026-10-01");
  });
});

describe("isValidDayKey", () => {
  it("accepts well-formed YYYY-MM-DD values", () => {
    expect(isValidDayKey("2026-10-01")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isValidDayKey("10/01/2026")).toBe(false);
    expect(isValidDayKey("not-a-date")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
  });
});

describe("shiftDayKey", () => {
  it("steps forward and backward across a month boundary", () => {
    expect(shiftDayKey("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDayKey("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("last7Days", () => {
  it("returns 7 consecutive days ending on the given day, oldest first", () => {
    expect(last7Days("2026-10-01")).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
  });
});
