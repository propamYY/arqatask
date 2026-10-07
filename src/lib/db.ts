import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dayKeyOf, last7Days } from "@/lib/date";
import seedTrips from "@/data/trips-seed.json";
import { summarize, type PaymentMethod, type Trip } from "@/lib/shift";

function resolveDbPath(): string {
  if (process.env.SHIFT_DB_PATH) return process.env.SHIFT_DB_PATH;
  // Vercel's filesystem is read-only outside /tmp; a committed data/ path
  // would crash on first write in production. /tmp is ephemeral per
  // instance, which is an acceptable tradeoff for a demo deployment —
  // documented in the README rather than silently losing data.
  if (process.env.VERCEL) return path.join("/tmp", "shifts.db");
  return path.join(process.cwd(), "data", "shifts.db");
}

const DB_PATH = resolveDbPath();

function openDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      amount REAL NOT NULL,
      payment TEXT NOT NULL CHECK (payment IN ('cash','card')),
      commission REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_trips_day ON trips(day);
  `);
  return db;
}

const insertSql = `
  INSERT INTO trips (id, day, start, end, amount, payment, commission)
  VALUES (@id, @day, @start, @end, @amount, @payment, @commission)
`;

function seedIfEmpty(db: Database.Database) {
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM trips")
    .get() as { count: number };
  if (count > 0) return;

  const insert = db.prepare(insertSql);
  const seedAll = db.transaction((trips: Trip[]) => {
    for (const trip of trips) {
      insert.run({ ...trip, day: dayKeyOf(trip.start) });
    }
  });
  seedAll(seedTrips as Trip[]);
}

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = openDb();
    seedIfEmpty(dbInstance);
  }
  return dbInstance;
}

export function tripsForDay(day: string): Trip[] {
  return getDb()
    .prepare(
      "SELECT id, start, end, amount, payment, commission FROM trips WHERE day = ? ORDER BY start ASC",
    )
    .all(day) as Trip[];
}

export function findTripById(id: string): Trip | undefined {
  return getDb()
    .prepare(
      "SELECT id, start, end, amount, payment, commission FROM trips WHERE id = ?",
    )
    .get(id) as Trip | undefined;
}

export function insertTrip(trip: Trip): void {
  getDb()
    .prepare(insertSql)
    .run({ ...trip, day: dayKeyOf(trip.start) });
}

/**
 * Deterministic idempotency key for trips submitted without a client id.
 * Hashing the business fields (not `id`) means a byte-identical retry of
 * the same payload is recognized as a duplicate even if the caller never
 * supplied an id — the same guarantee an explicit idempotency-key header
 * would give, derived instead from the request content itself.
 */
export function fingerprintTrip(input: {
  start: string;
  end: string;
  amount: number;
  payment: PaymentMethod;
}): string {
  const normalized = JSON.stringify({
    start: input.start,
    end: input.end,
    amount: input.amount,
    payment: input.payment,
  });
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export interface DayNet {
  date: string;
  net: number;
  count: number;
}

/** Net earnings for each of the 7 days ending on `day`, oldest first. */
export function weeklyNet(day: string): DayNet[] {
  return last7Days(day).map((date) => {
    const summary = summarize(tripsForDay(date));
    return { date, net: summary.net, count: summary.count };
  });
}

/** All-time totals across every trip ever recorded, for the profile header. */
export function allTimeTotals(): { totalTrips: number; totalNet: number } {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) as totalTrips, COALESCE(SUM(amount - commission), 0) as totalNet FROM trips",
    )
    .get() as { totalTrips: number; totalNet: number };
  return row;
}

/** Test-only: wipe and reseed so each test file starts from a known state. */
export function resetDb(): void {
  const db = getDb();
  db.exec("DELETE FROM trips");
  seedIfEmpty(db);
}
