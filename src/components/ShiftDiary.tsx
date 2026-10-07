"use client";

import { useState } from "react";
import useSWR from "swr";
import { shiftDayKey } from "@/lib/date";
import type { DaySummary, PaymentMethod, Trip } from "@/lib/shift";

const DEFAULT_DAY = "2026-10-01";
const SHIFT_OFFSET = "+05:00";

type DayResponse = { date: string; trips: Trip[]; summary: DaySummary };

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
function tenge(amount: number): string {
  return `${money.format(amount)} ₸`;
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

async function fetchDay(url: string): Promise<DayResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export default function ShiftDiary() {
  const [day, setDay] = useState(DEFAULT_DAY);
  const [formOpen, setFormOpen] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(
    `/api/days/${day}`,
    fetchDay,
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-[#EEF1F5] px-4 py-6">
      <DaySwitcher day={day} onChange={setDay} />

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Не удалось загрузить данные за этот день.
        </p>
      )}

      <ReceiptCard day={day} summary={data?.summary ?? null} loading={isLoading} />

      <button
        onClick={() => setFormOpen((open) => !open)}
        className="rounded-xl bg-[#2D5BE3] px-4 py-3 text-sm font-semibold text-white transition active:bg-[#1F45B8]"
      >
        {formOpen ? "Закрыть форму" : "+ Добавить поездку"}
      </button>

      {formOpen && (
        <AddTripForm
          day={day}
          onAdded={() => {
            setFormOpen(false);
            mutate();
          }}
        />
      )}

      <TripList trips={data?.trips ?? []} loading={isLoading} />
    </div>
  );
}

function DaySwitcher({
  day,
  onChange,
}: {
  day: string;
  onChange: (day: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
      <button
        aria-label="Предыдущий день"
        onClick={() => onChange(shiftDayKey(day, -1))}
        className="rounded-lg px-3 py-2 text-lg text-[#2D5BE3] active:bg-[#E6ECFD]"
      >
        ←
      </button>
      <span className="font-mono text-base font-semibold text-[#1C2633]">
        {formatDay(day)}
      </span>
      <button
        aria-label="Следующий день"
        onClick={() => onChange(shiftDayKey(day, 1))}
        className="rounded-lg px-3 py-2 text-lg text-[#2D5BE3] active:bg-[#E6ECFD]"
      >
        →
      </button>
    </div>
  );
}

function ReceiptCard({
  day,
  summary,
  loading,
}: {
  day: string;
  summary: DaySummary | null;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#FFF8E1] p-6 font-mono text-sm text-[#2B2618] shadow-md">
      <div className="text-center font-semibold">Дневник смен</div>
      <div className="mb-3 text-center text-[#7A7058]">{formatDay(day)}</div>

      {loading && <div className="py-6 text-center text-[#7A7058]">Загрузка…</div>}

      {!loading && summary && (
        <>
          <Row label="Поездок" value={String(summary.count)} />
          <Row label="Выручка" value={tenge(summary.revenue)} />
          <Row label="Комиссия" value={`−${tenge(summary.commission)}`} />
          <Row
            label="Наличные / карта"
            value={`${tenge(summary.byPayment.cash)} / ${tenge(summary.byPayment.card)}`}
          />
          <div className="my-3 border-t border-dashed border-[#CDBF95]" />
          <div className="flex items-baseline justify-between">
            <span>На руки</span>
            <strong className="text-xl text-[#1C2633]">
              {tenge(summary.net)}
            </strong>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function TripList({ trips, loading }: { trips: Trip[]; loading: boolean }) {
  if (loading) return null;

  if (trips.length === 0) {
    return (
      <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-[#6B7788] shadow-sm">
        В этот день поездок нет.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {trips.map((trip) => (
        <li
          key={trip.id}
          className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
        >
          <div>
            <div className="font-mono text-sm text-[#1C2633]">
              {timeOf(trip.start)}–{timeOf(trip.end)}
            </div>
            <span
              className={
                "mt-1 inline-block rounded-full px-2 py-0.5 text-xs " +
                (trip.payment === "cash"
                  ? "bg-[#FFF1DC] text-[#8A4B08]"
                  : "bg-[#E6ECFD] text-[#1F45B8]")
              }
            >
              {trip.payment === "cash" ? "наличные" : "карта"}
            </span>
          </div>
          <div className="font-mono text-sm font-semibold text-[#1C2633]">
            {tenge(trip.amount)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AddTripForm({
  day,
  onAdded,
}: {
  day: string;
  onAdded: () => void;
}) {
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("08:20");
  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          start: `${day}T${start}:00${SHIFT_OFFSET}`,
          end: `${day}T${end}:00${SHIFT_OFFSET}`,
          amount: Number(amount),
          commission: Number(commission),
          payment,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        const issue = body?.issues?.[0]?.message ?? body?.error ?? "Ошибка";
        setMessage(issue);
        return;
      }

      if (body.duplicate) {
        setMessage("Такая поездка уже есть — дубль не создан.");
      } else {
        onAdded();
      }
    } catch {
      setMessage("Не удалось отправить запрос.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-[#1C2633]">
          Начало
          <input
            type="time"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D5DBE3] px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-[#1C2633]">
          Конец
          <input
            type="time"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D5DBE3] px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-[#1C2633]">
          Сумма, ₸
          <input
            type="number"
            min="1"
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D5DBE3] px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-[#1C2633]">
          Комиссия, ₸
          <input
            type="number"
            min="0"
            step="1"
            required
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D5DBE3] px-3 py-2"
          />
        </label>
      </div>

      <label className="text-sm font-medium text-[#1C2633]">
        Оплата
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value as PaymentMethod)}
          className="mt-1 w-full rounded-lg border border-[#D5DBE3] px-3 py-2"
        >
          <option value="card">Карта</option>
          <option value="cash">Наличные</option>
        </select>
      </label>

      {message && <p className="text-sm text-[#B42318]">{message}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-[#2D5BE3] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Отправка…" : "Сохранить поездку"}
      </button>
    </form>
  );
}
