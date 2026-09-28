"use client";

import { useChallenges } from "@/lib/hooks/use-challenges";
import { toProgress } from "@/lib/progress";
import { PageLoading } from "@/components/page-loading";

export default function BadgesPage() {
  const { challenges, myProgress, myCompletions, loading } = useChallenges();

  // Keep a badge you earned even after the challenge is archived.
  const shown = challenges.filter((c) => !c.archived || myCompletions.get(c.id)?.status === "approved");

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
          {shown.map((c) => {
            const completion = myCompletions.get(c.id);
            const earned = completion?.status === "approved" ? completion : undefined;
            const p = toProgress(c, myProgress.get(c.id) ?? 0);
            const pendingLabel =
              completion?.status === "pending"
                ? "Under review"
                : completion?.status === "awaiting_proof"
                  ? "Upload proof to claim"
                  : completion?.status === "rejected"
                    ? "Proof rejected — resubmit"
                    : null;
            return (
              <div key={c.id} className={`rounded-2xl border border-line p-5 text-center ${earned ? "" : "opacity-40"}`}>
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                    earned ? "bg-red-soft" : "bg-bg-soft"
                  }`}
                >
                  {c.emoji}
                </div>
                <div className="mt-2.5 text-[13px] font-bold">{c.title}</div>
                <div className="mt-0.5 text-[11.5px] font-semibold text-ink-soft">
                  {earned
                    ? `Earned · ${earned.points} pts${earned.champion ? " 🏆" : ""}`
                    : (pendingLabel ?? `${p.value} / ${p.goal} ${p.unit}`)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
