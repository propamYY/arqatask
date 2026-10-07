import { NextResponse, type NextRequest } from "next/server";
import { isValidDayKey } from "@/lib/date";
import { tripsForDay } from "@/lib/db";
import { summarize } from "@/lib/shift";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;

  if (!isValidDayKey(date)) {
    return NextResponse.json(
      { error: "Invalid date, expected YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const trips = tripsForDay(date);
  return NextResponse.json({ date, trips, summary: summarize(trips) });
}
