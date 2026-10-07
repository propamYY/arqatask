import { z } from "zod";

export type PaymentMethod = "cash" | "card";

export interface Trip {
  id: string;
  start: string;
  end: string;
  amount: number;
  payment: PaymentMethod;
  commission: number;
}

export interface DaySummary {
  count: number;
  revenue: number;
  commission: number;
  net: number;
  byPayment: { cash: number; card: number };
}

/**
 * Pure aggregation over an already-filtered list of trips for one day.
 * Kept free of any date/timezone logic so it's trivial to unit test.
 */
export function summarize(trips: Trip[]): DaySummary {
  let revenue = 0;
  let commission = 0;
  let cash = 0;
  let card = 0;

  for (const trip of trips) {
    revenue += trip.amount;
    commission += trip.commission;
    if (trip.payment === "cash") cash += trip.amount;
    else card += trip.amount;
  }

  return {
    count: trips.length,
    revenue,
    commission,
    net: revenue - commission,
    byPayment: { cash, card },
  };
}

/**
 * Commission is a platform rate, not something a driver enters — fixed here
 * so the server is the only source of truth for it. A client-supplied value
 * (old app versions, a tampered request) is accepted by the schema's
 * backward-compatible shape but never used to compute the stored trip.
 */
export const COMMISSION_RATE = 0.15;

export function computeCommission(amount: number): number {
  return Math.round(amount * COMMISSION_RATE);
}

export const tripInputSchema = z
  .object({
    id: z.string().trim().min(1).max(200).optional(),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    amount: z.number().positive("amount must be greater than 0"),
    payment: z.enum(["cash", "card"]),
  })
  .refine(
    (data) => new Date(data.end).getTime() > new Date(data.start).getTime(),
    { message: "end must be after start", path: ["end"] },
  );

export type TripInput = z.infer<typeof tripInputSchema>;
