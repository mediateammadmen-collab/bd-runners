"use client";

import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useCommunityData } from "@/lib/hooks/use-community-data";
import { ChallengeCard } from "@/components/challenge-card";
import { PageLoading } from "@/components/page-loading";

export default function ChallengesPage() {
  const router = useRouter();
  const { user } = useSupabase();
  const { challenges, runs, champions, loading } = useCommunityData();

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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {challenges.map((c) => {
            const myRuns = runs.filter((r) => r.challenge_id === c.id && r.runner_id === user?.id);
            const participants = new Set(
              runs.filter((r) => r.challenge_id === c.id).map((r) => r.runner_id),
            ).size;
            const champion = champions.find((ch) => ch.challenge_id === c.id);
            return (
              <ChallengeCard
                key={c.id}
                challenge={c}
                myRuns={myRuns}
                participants={participants}
                championName={champion?.profiles?.name}
                onLog={() => router.push(`/log?challenge=${c.id}`)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
