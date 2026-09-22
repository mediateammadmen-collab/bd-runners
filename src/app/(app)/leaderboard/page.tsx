"use client";

import { useMemo, useState } from "react";
import { useCommunityData, type RunWithProfile } from "@/lib/hooks/use-community-data";
import { progressFor, timeAgo } from "@/lib/progress";
import { PageLoading } from "@/components/page-loading";

export default function LeaderboardPage() {
  const { challenges, runs, loading } = useCommunityData();
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeChallenge = challenges.find((c) => c.id === activeId) ?? challenges[0];

  const rows = useMemo(() => {
    if (!activeChallenge) return [];
    const byRunner = new Map<string, { name: string; runs: RunWithProfile[] }>();
    runs
      .filter((r) => r.challenge_id === activeChallenge.id)
      .forEach((r) => {
        const key = r.runner_id;
        const name = r.profiles?.name ?? "Runner";
        if (!byRunner.has(key)) byRunner.set(key, { name, runs: [] });
        byRunner.get(key)!.runs.push(r);
      });
    return Array.from(byRunner.entries())
      .map(([id, v]) => {
        const p = progressFor(activeChallenge, v.runs);
        return { id, name: v.name, value: p.value, unit: p.unit, done: p.done };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [activeChallenge, runs]);

  const feed = useMemo(
    () =>
      runs
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20),
    [runs],
  );

  if (loading) return <PageLoading />;

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold">Leaderboard</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Ranked by challenge progress.</p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {challenges.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
              activeChallenge?.id === c.id
                ? "border-red bg-red text-white"
                : "border-line bg-bg-card text-ink-soft"
            }`}
          >
            {c.emoji} {c.title}
          </button>
        ))}
      </div>

      <div className="mb-9 rounded-2xl border border-line bg-bg-card p-2">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-ink-soft">
            No runs logged for this challenge yet — be the first.
          </div>
        ) : (
          rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3.5 border-b border-line px-3 py-3 last:border-0">
              <div className="w-6 text-center text-[12.5px] font-extrabold text-ink-soft">{i + 1}</div>
              <div className="flex-1 font-bold">
                {r.name}
                {r.done ? " 🏅" : ""}
              </div>
              <div className="font-extrabold text-red">
                {r.value} <span className="text-[12px] font-medium text-ink-soft">{r.unit}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-[22px] font-extrabold">Community feed</h2>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Recent runs from across Bangladesh.</p>
      </div>
      <div className="rounded-2xl border border-line bg-bg-card p-2">
        {feed.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-ink-soft">
            No runs yet. Log yours and be the first on the feed.
          </div>
        ) : (
          feed.map((r) => {
            const challenge = challenges.find((c) => c.id === r.challenge_id);
            return (
              <div key={r.id} className="border-b border-line px-3 py-3.5 text-[14px] last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-bold">{r.profiles?.name ?? "Runner"}</span>
                  <span className="text-[14px] font-extrabold text-red">{r.distance_km} km</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-ink-soft">
                  <span className="rounded-full border border-line bg-bg-soft px-2.5 py-0.5 text-[11px] font-bold">
                    {challenge ? `${challenge.emoji} ${challenge.title}` : "Free run"}
                  </span>
                  <span>
                    {r.source} · {timeAgo(r.created_at)}
                  </span>
                </div>
                {r.note && <div className="mt-1.5 text-[13px] italic text-ink-soft">&quot;{r.note}&quot;</div>}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
