const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Trip timestamps are ISO 8601 strings with an explicit UTC offset
 * (e.g. "2026-10-01T23:50:00+05:00"). The offset already encodes the
 * driver's local wall-clock time, so the calendar day is just the date
 * portion of the string — converting through `new Date(...)` first would
 * silently shift late-night trips onto the wrong day whenever the
 * offset isn't UTC.
 */
export function dayKeyOf(iso: string): string {
  return iso.slice(0, 10);
}

export function isValidDayKey(value: string): boolean {
  if (!DAY_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function todayKey(): string {
  return dayKeyOf(new Date().toISOString());
}

export function shiftDayKey(day: string, deltaDays: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + deltaDays));
  return next.toISOString().slice(0, 10);
}

/** The 7 calendar days ending on `day` (inclusive), oldest first. */
export function last7Days(day: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(day, i - 6));
}
