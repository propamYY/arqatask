import { NextResponse, type NextRequest } from "next/server";
import { isValidDayKey } from "@/lib/date";
import { weeklyNet } from "@/lib/db";

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

  const days = weeklyNet(date);
  const best = days.reduce((max, day) => (day.net > max.net ? day : max));

  return NextResponse.json({ days, best: best.date });
}
