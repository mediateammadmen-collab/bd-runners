"use client";

import { useSupabase } from "@/components/providers/supabase-provider";
import { useCommunityData } from "@/lib/hooks/use-community-data";
import { progressFor } from "@/lib/progress";
import { PageLoading } from "@/components/page-loading";

export default function BadgesPage() {
  const { user } = useSupabase();
  const { challenges, runs, completions, loading } = useCommunityData();

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold">My badges</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Earn one by hitting a challenge&apos;s goal.</p>
      </div>

      {loading ? (
        <PageLoading count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
          {challenges.map((c) => {
            const myRuns = runs.filter((r) => r.challenge_id === c.id && r.runner_id === user?.id);
            const p = progressFor(c, myRuns);
            const mine = completions.find((x) => x.challenge_id === c.id && x.runner_id === user?.id);
            return (
              <div key={c.id} className={`rounded-2xl border border-line p-5 text-center ${p.done ? "" : "opacity-40"}`}>
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                    p.done ? "bg-red-soft" : "bg-bg-soft"
                  }`}
                >
                  {c.emoji}
                </div>
                <div className="mt-2.5 text-[13px] font-bold">{c.title}</div>
                <div className="mt-0.5 text-[11.5px] font-semibold text-ink-soft">
                  {p.done
                    ? `Earned · ${mine?.points ?? c.points} pts${mine?.champion ? " 🏆" : ""}`
                    : `${p.value} / ${p.goal} ${p.unit}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
