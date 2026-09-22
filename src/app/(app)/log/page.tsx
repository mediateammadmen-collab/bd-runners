"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { todayISO } from "@/lib/progress";
import type { Database } from "@/lib/supabase/types";

type Challenge = Database["public"]["Tables"]["challenges"]["Row"];

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
  const [toast, setToast] = useState<{ type: "ok" | "error" | "earned"; text: string } | null>(null);

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
      .order("sort_order")
      .then(({ data }) => setChallenges(data ?? []));
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setToast(null);
    const distanceNum = parseFloat(distance);
    if (!distanceNum || distanceNum <= 0) {
      setToast({ type: "error", text: "Enter a distance greater than 0 km." });
      return;
    }
    if (date > todayISO()) {
      setToast({ type: "error", text: "Date can't be in the future." });
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

    const result = data as { completed?: boolean; champion?: boolean; points?: number } | null;
    if (result?.completed) {
      const challenge = challenges.find((c) => c.id === challengeId);
      setToast({
        type: "earned",
        text: result.champion
          ? `🏆 ${challenge?.emoji ?? ""} ${challenge?.title ?? "Challenge"} complete — you're the FASTEST finisher! +${result.points} pts.`
          : `${challenge?.emoji ?? ""} ${challenge?.title ?? "Challenge"} complete! +${result.points} pts.`,
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
