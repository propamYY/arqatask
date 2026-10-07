import { NextResponse, type NextRequest } from "next/server";
import { findTripById, fingerprintTrip, insertTrip } from "@/lib/db";
import { tripInputSchema } from "@/lib/shift";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = tripInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  // Idempotency key: the caller's own id when provided, otherwise a
  // content fingerprint — so a retried request is recognized as a
  // duplicate even without an explicit id. See fingerprintTrip() in db.ts.
  const id = input.id ?? fingerprintTrip(input);

  const existing = findTripById(id);
  if (existing) {
    return NextResponse.json({ trip: existing, duplicate: true }, { status: 200 });
  }

  const trip = {
    id,
    start: input.start,
    end: input.end,
    amount: input.amount,
    payment: input.payment,
    commission: input.commission,
  };
  insertTrip(trip);

  return NextResponse.json({ trip, duplicate: false }, { status: 201 });
}
