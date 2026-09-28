"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useChallenges } from "@/lib/hooks/use-challenges";
import { timeAgo, toProgress } from "@/lib/progress";
import { PageLoading } from "@/components/page-loading";
import type { Database } from "@/lib/supabase/types";

type ProgressRow = Database["public"]["Views"]["challenge_progress"]["Row"];
type FeedRun = Database["public"]["Tables"]["runs"]["Row"] & { profiles: { name: string } | null };

export default function LeaderboardPage() {
  const { supabase } = useSupabase();
  const { challenges, loading: challengesLoading } = useChallenges();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [feed, setFeed] = useState<FeedRun[]>([]);

  const visible = useMemo(() => challenges.filter((c) => !c.archived), [challenges]);
  const activeChallenge = useMemo(
    () => visible.find((c) => c.id === activeId) ?? visible[0],
    [visible, activeId],
  );
  const activeChallengeId = activeChallenge?.id ?? null;

  const load = useCallback(async () => {
    const [board, recent] = await Promise.all([
      activeChallengeId
        ? supabase
            .from("challenge_progress")
            .select("*")
            .eq("challenge_id", activeChallengeId)
            .order("progress", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] as ProgressRow[] }),
      supabase.from("runs").select("*, profiles(name)").order("created_at", { ascending: false }).limit(20),
    ]);
    setRows(board.data ?? []);
    setFeed((recent.data as unknown as FeedRun[]) ?? []);
  }, [supabase, activeChallengeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + realtime subscription on mount
    load();
    const channel = supabase
      .channel(`leaderboard-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  if (challengesLoading) return <PageLoading />;

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold">Leaderboard</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Ranked by challenge progress.</p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {visible.map((c) => (
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
        {rows.length === 0 || !activeChallenge ? (
          <div className="p-10 text-center text-[14px] text-ink-soft">
            No runs logged for this challenge yet — be the first.
          </div>
        ) : (
          rows.map((r, i) => {
            const p = toProgress(activeChallenge, Number(r.progress));
            return (
              <div key={r.runner_id} className="flex items-center gap-3.5 border-b border-line px-3 py-3 last:border-0">
                <div className="w-6 text-center text-[12.5px] font-extrabold text-ink-soft">{i + 1}</div>
                <div className="flex-1 font-bold">
                  {r.runner_name}
                  {p.done ? " 🏅" : ""}
                </div>
                <div className="font-extrabold text-red">
                  {p.value} <span className="text-[12px] font-medium text-ink-soft">{p.unit}</span>
                </div>
              </div>
            );
          })
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
