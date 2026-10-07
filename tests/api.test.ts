import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/days/[date]/route";
import { GET as GET_PROFILE } from "@/app/api/profile/route";
import { GET as GET_TREND } from "@/app/api/trend/[date]/route";
import { POST } from "@/app/api/trips/route";
import { resetDb } from "@/lib/db";

beforeEach(() => {
  resetDb();
});

function postTrip(body: unknown) {
  const req = new NextRequest("http://localhost/api/trips", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

function getDay(date: string) {
  return GET(new NextRequest(`http://localhost/api/days/${date}`), {
    params: Promise.resolve({ date }),
  });
}

function getTrend(date: string) {
  return GET_TREND(new NextRequest(`http://localhost/api/trend/${date}`), {
    params: Promise.resolve({ date }),
  });
}

describe("GET /api/days/[date]", () => {
  it("returns the seeded summary for 2026-10-01, matching the task's example", async () => {
    const res = await getDay("2026-10-01");
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.trips).toHaveLength(3); // t1, t2, plus the extra seed trip t6
    expect(payload.summary.net).toBe(payload.summary.revenue - payload.summary.commission);
  });

  it("rejects a malformed date", async () => {
    const res = await getDay("not-a-date");
    expect(res.status).toBe(400);
  });

  it("returns an empty summary for a day with no trips", async () => {
    const res = await getDay("2099-01-01");
    const payload = await res.json();
    expect(payload.trips).toEqual([]);
    expect(payload.summary.count).toBe(0);
  });
});

describe("POST /api/trips", () => {
  it("rejects a non-positive amount", async () => {
    const res = await postTrip({
      start: "2026-10-05T08:00:00+05:00",
      end: "2026-10-05T08:10:00+05:00",
      amount: 0,
      payment: "cash",
      commission: 0,
    });
    expect(res.status).toBe(400);
  });

  it("rejects an end time that is not after the start time", async () => {
    const res = await postTrip({
      start: "2026-10-05T08:10:00+05:00",
      end: "2026-10-05T08:00:00+05:00",
      amount: 100,
      payment: "cash",
      commission: 10,
    });
    expect(res.status).toBe(400);
  });

  it("creates a trip that immediately shows up in that day's summary", async () => {
    const res = await postTrip({
      id: "new-1",
      start: "2026-10-05T08:00:00+05:00",
      end: "2026-10-05T08:10:00+05:00",
      amount: 1000,
      payment: "card",
      commission: 150,
    });
    expect(res.status).toBe(201);

    const dayPayload = await (await getDay("2026-10-05")).json();
    expect(dayPayload.summary).toEqual({
      count: 1,
      revenue: 1000,
      commission: 150,
      net: 850,
      byPayment: { cash: 0, card: 1000 },
    });
  });

  it("does not create a duplicate when the same trip id is submitted twice", async () => {
    const body = {
      id: "dup-1",
      start: "2026-10-06T08:00:00+05:00",
      end: "2026-10-06T08:10:00+05:00",
      amount: 500,
      payment: "cash",
      commission: 75,
    };

    const first = await postTrip(body);
    const second = await postTrip(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);

    const dayPayload = await (await getDay("2026-10-06")).json();
    expect(dayPayload.summary.count).toBe(1);
  });

  it("deduplicates an identical retry even when no id is supplied", async () => {
    const body = {
      start: "2026-10-07T08:00:00+05:00",
      end: "2026-10-07T08:10:00+05:00",
      amount: 700,
      payment: "cash",
      commission: 100,
    };

    const first = await postTrip(body);
    const second = await postTrip(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const dayPayload = await (await getDay("2026-10-07")).json();
    expect(dayPayload.summary.count).toBe(1);
  });

  it("treats two different trips on the same day as distinct, not duplicates", async () => {
    await postTrip({
      start: "2026-10-08T08:00:00+05:00",
      end: "2026-10-08T08:10:00+05:00",
      amount: 700,
      payment: "cash",
      commission: 100,
    });
    await postTrip({
      start: "2026-10-08T09:00:00+05:00",
      end: "2026-10-08T09:10:00+05:00",
      amount: 700,
      payment: "cash",
      commission: 100,
    });

    const dayPayload = await (await getDay("2026-10-08")).json();
    expect(dayPayload.summary.count).toBe(2);
  });
});

describe("GET /api/trend/[date]", () => {
  it("returns 7 days ending on the given date, with the highest-net day marked best", async () => {
    const res = await getTrend("2026-10-01");
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.days).toHaveLength(7);
    expect(payload.days[0].date).toBe("2026-09-25");
    expect(payload.days[6].date).toBe("2026-10-01");

    // Seeded so 2026-09-28 is the best day of this window (net 7650),
    // ahead of 2026-10-01 itself (net 5015) — exercises a "best day" that
    // isn't just whichever day happens to be selected.
    expect(payload.best).toBe("2026-09-28");
  });

  it("rejects a malformed date", async () => {
    const res = await getTrend("not-a-date");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/profile", () => {
  it("returns lifetime totals computed from the seeded trips", async () => {
    const res = await GET_PROFILE();
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.totalTrips).toBeGreaterThan(0);
    expect(typeof payload.totalNet).toBe("number");
    expect(payload.name).toBeTruthy();
  });

  it("grows totalTrips after a new trip is added", async () => {
    const before = await (await GET_PROFILE()).json();

    await postTrip({
      start: "2026-10-09T08:00:00+05:00",
      end: "2026-10-09T08:10:00+05:00",
      amount: 500,
      payment: "cash",
      commission: 75,
    });

    const after = await (await GET_PROFILE()).json();
    expect(after.totalTrips).toBe(before.totalTrips + 1);
    expect(after.totalNet).toBe(before.totalNet + 425);
  });
});
