"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { challengeStatus, formatDate, round1, todayISO } from "@/lib/progress";
import type { Database } from "@/lib/supabase/types";

type Challenge = Database["public"]["Tables"]["challenges"]["Row"];

// Mirrors c_max_run_km in log_run(); the database is the real enforcement.
const MAX_RUN_KM = 100;

const SOURCES = [
  "Strava",
  "Garmin",
  "Coros / Suunto",
  "Apple Health",
  "Nike Run Club / other app",
  "Manual — no tracker",
];

function LogForm() {
  const { supabase } = useSupabase();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("challenge") ?? "";

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [distance, setDistance] = useState("");
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState(SOURCES[SOURCES.length - 1]);
  const [challengeId, setChallengeId] = useState(preselect);
  const [syncedPreselect, setSyncedPreselect] = useState(preselect);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "ok" | "error" | "earned";
    text: string;
    proofChallengeId?: string;
  } | null>(null);

  // Reset the selected challenge when the ?challenge= query param changes
  // (e.g. navigating here from a different challenge's "Log a run" button).
  if (preselect !== syncedPreselect) {
    setSyncedPreselect(preselect);
    setChallengeId(preselect);
  }

  useEffect(() => {
    supabase
      .from("challenges")
      .select("*")
      .eq("archived", false)
      .order("sort_order")
      .then(({ data }) => {
        const open = (data ?? []).filter((c) => challengeStatus(c) === "active");
        setChallenges(open);
        setChallengeId((id) => (open.some((c) => c.id === id) ? id : ""));
      });
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setToast(null);
    const distanceNum = round1(parseFloat(distance));
    if (!distanceNum || distanceNum <= 0) {
      setToast({ type: "error", text: "Enter a distance greater than 0 km." });
      return;
    }
    if (distanceNum > MAX_RUN_KM) {
      setToast({ type: "error", text: `A single run can't be more than ${MAX_RUN_KM} km.` });
      return;
    }
    if (date > todayISO()) {
      setToast({ type: "error", text: "Date can't be in the future." });
      return;
    }
    const selected = challenges.find((c) => c.id === challengeId);
    if (selected?.starts_at && date < selected.starts_at) {
      setToast({ type: "error", text: `${selected.title} starts on ${formatDate(selected.starts_at)}.` });
      return;
    }
    if (selected?.ends_at && date > selected.ends_at) {
      setToast({ type: "error", text: `${selected.title} ended on ${formatDate(selected.ends_at)}.` });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("log_run", {
      p_distance_km: distanceNum,
      p_date: date,
      p_source: source,
      p_challenge_id: challengeId || null,
      p_note: note || null,
    });
    setSubmitting(false);

    if (error) {
      setToast({ type: "error", text: error.message });
      return;
    }

    setDistance("");
    setNote("");

    const result = data as { completed?: boolean; points?: number; challenge_id?: string } | null;
    if (result?.completed && result.challenge_id) {
      const challenge = challenges.find((c) => c.id === result.challenge_id);
      setToast({
        type: "earned",
        text: `${challenge?.emoji ?? "🎯"} Goal reached on ${challenge?.title ?? "your challenge"}! Upload your proof photo to claim ${result.points} pts.`,
        proofChallengeId: result.challenge_id,
      });
    } else {
      setToast({ type: "ok", text: "Run logged. Great work — keep it up." });
    }
  }

  return (
    <section className="max-w-[520px]">
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold">Log a run</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">
          Enter it however you tracked it — we don&apos;t require any specific app.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-bg-card p-6">
        <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="distance">
          Distance (km)
        </label>
        <input
          id="distance"
          type="number"
          min="0.1"
          max={MAX_RUN_KM}
          step="0.1"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          placeholder="e.g. 5.2"
          className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              max={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="source">
              Tracked with
            </label>
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-bold text-ink-soft" htmlFor="challenge">
          Count toward challenge
        </label>
        <select
          id="challenge"
          value={challengeId}
          onChange={(e) => setChallengeId(e.target.value)}
          className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
        >
          <option value="">Free run — no challenge</option>
          {challenges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-bold text-ink-soft" htmlFor="note">
          Note (optional)
        </label>
        <textarea
          id="note"
          maxLength={140}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How did it feel? Where did you run?"
          className="min-h-[64px] w-full resize-y rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-full bg-red py-3.5 text-[14.5px] font-bold text-white transition disabled:opacity-50"
        >
          {submitting ? "Logging…" : "Log this run"}
        </button>

        {toast && (
          <div
            className={`mt-4 rounded-xl px-4 py-3 text-[13.5px] font-semibold ${
              toast.type === "earned" ? "bg-ink text-white" : "bg-red-soft text-red-deep"
            }`}
          >
            {toast.text}
            {toast.proofChallengeId && (
              <Link
                href={`/proof?challenge=${toast.proofChallengeId}`}
                className="mt-3 block w-full rounded-full bg-red py-2.5 text-center text-[13px] font-bold text-white"
              >
                📸 Upload proof now
              </Link>
            )}
          </div>
        )}
      </form>
    </section>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={null}>
      <LogForm />
    </Suspense>
  );
}
