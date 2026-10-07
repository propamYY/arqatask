import { NextResponse } from "next/server";
import { allTimeTotals } from "@/lib/db";

// Demo profile — a real app would read this from the authenticated driver's
// account. Lifetime stats below are not: they're computed live from the DB.
const DRIVER = {
  name: "Данияр Касымов",
  initials: "ДК",
  car: "Toyota Camry · 987 ABC 02",
  rating: 4.9,
};

export async function GET() {
  const { totalTrips, totalNet } = allTimeTotals();
  return NextResponse.json({ ...DRIVER, totalTrips, totalNet });
}
