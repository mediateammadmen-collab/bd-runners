"use client";

import { useRouter } from "next/navigation";
import { useChallenges } from "@/lib/hooks/use-challenges";
import { ChallengeCard } from "@/components/challenge-card";
import { PageLoading } from "@/components/page-loading";
import { challengeStatus, toProgress } from "@/lib/progress";

const STATUS_ORDER = { active: 0, upcoming: 1, ended: 2 } as const;

export default function ChallengesPage() {
  const router = useRouter();
  const { challenges, stats, champions, myProgress, myCompletions, loading } = useChallenges();

  const visible = challenges
    .filter((c) => !c.archived)
    .sort((a, b) => STATUS_ORDER[challengeStatus(a)] - STATUS_ORDER[challengeStatus(b)]);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-extrabold">Live challenges</h1>
        <span className="text-[13.5px] font-medium text-ink-soft">
          Any tracking app works — Strava, Garmin, Coros, Apple Health, or none at all.
        </span>
      </div>

      {loading ? (
        <PageLoading />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-line bg-bg-card p-10 text-center text-[14px] text-ink-soft">
          No challenges right now — check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              progress={toProgress(c, myProgress.get(c.id) ?? 0)}
              completion={myCompletions.get(c.id)}
              participants={stats.get(c.id)?.participants ?? 0}
              championName={champions.get(c.id)}
              onLog={() => router.push(`/log?challenge=${c.id}`)}
              onProof={() => router.push(`/proof?challenge=${c.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
