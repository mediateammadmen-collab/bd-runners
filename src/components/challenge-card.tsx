import { ProgressRing } from "@/components/progress-ring";
import { progressFor, type Challenge, type Run } from "@/lib/progress";

export function ChallengeCard({
  challenge,
  myRuns,
  participants,
  championName,
  onLog,
}: {
  challenge: Challenge;
  myRuns: Run[];
  participants: number;
  championName?: string | null;
  onLog: () => void;
}) {
  const p = progressFor(challenge, myRuns);

  return (
    <div className="rounded-2xl border border-line bg-bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16.5px] font-extrabold tracking-tight">{challenge.title}</h3>
          <p className="mt-1.5 min-h-9 text-[13px] font-medium text-ink-soft">{challenge.description}</p>
        </div>
        <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-red-soft text-[19px]">
          {challenge.emoji}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3.5">
        <div className="relative flex-none">
          <ProgressRing pct={p.pct} done={p.done} />
          <div className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold">
            {p.done ? "✓" : `${Math.round(p.pct)}%`}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold">
            {p.value} / {p.goal} {p.unit}
          </div>
          <div className="mt-0.5 text-[11.5px] font-semibold text-ink-soft">
            {p.done ? "Completed" : "In progress"}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5 text-[12px] font-semibold text-ink-soft">
        <span>{challenge.window_label}</span>
        <span>
          {participants} runner{participants === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-2 text-[12px] font-semibold text-ink-soft">⭐ {challenge.points} pts on completion</div>
      <div className="mt-1.5 text-[12px] font-semibold text-ink-soft">
        {championName ? `🏆 Fastest: ${championName}` : `🏆 +${challenge.bonus} bonus pts for the first finisher`}
      </div>

      <button
        onClick={onLog}
        className={`mt-4 w-full rounded-full py-3 text-[13.5px] font-bold transition ${
          p.done ? "border border-line bg-bg-soft text-ink" : "bg-red text-white hover:opacity-90"
        }`}
      >
        {p.done ? "🏅 Badge earned — log another run" : "Log a run for this"}
      </button>
    </div>
  );
}
