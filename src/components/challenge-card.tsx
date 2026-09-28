import { ProgressRing } from "@/components/progress-ring";
import {
  challengeStatus,
  formatDate,
  windowText,
  type Challenge,
  type Progress,
} from "@/lib/progress";
import type { MyCompletion } from "@/lib/hooks/use-challenges";

const COMPLETION_LABEL: Record<MyCompletion["status"], string> = {
  awaiting_proof: "Goal reached — proof needed",
  pending: "Proof under review",
  approved: "Completed",
  rejected: "Proof rejected",
};

export function ChallengeCard({
  challenge,
  progress: p,
  completion,
  participants,
  championName,
  onLog,
  onProof,
}: {
  challenge: Challenge;
  progress: Progress;
  completion?: MyCompletion;
  participants: number;
  championName?: string | null;
  onLog: () => void;
  onProof: () => void;
}) {
  const status = challengeStatus(challenge);
  const window = windowText(challenge);
  const canLog = status === "active";

  const statusText = completion
    ? COMPLETION_LABEL[completion.status]
    : status === "ended"
      ? "Not completed"
      : "In progress";

  let action: { label: string; onClick?: () => void; style: "primary" | "muted" | "done" };
  if (completion?.status === "awaiting_proof") {
    action = { label: `📸 Upload proof to claim ${challenge.points} pts`, onClick: onProof, style: "primary" };
  } else if (completion?.status === "rejected") {
    action = { label: "📸 Resubmit proof", onClick: onProof, style: "primary" };
  } else if (completion?.status === "pending") {
    action = { label: "⏳ Proof under review", style: "muted" };
  } else if (completion?.status === "approved") {
    action = canLog
      ? { label: "🏅 Badge earned — log another run", onClick: onLog, style: "done" }
      : { label: "🏅 Completed", style: "muted" };
  } else if (status === "ended") {
    action = { label: "Challenge ended", style: "muted" };
  } else if (status === "upcoming" && challenge.starts_at) {
    action = { label: `Opens ${formatDate(challenge.starts_at)}`, style: "muted" };
  } else {
    action = { label: "Log a run for this", onClick: onLog, style: "primary" };
  }

  return (
    <div className={`rounded-2xl border border-line bg-bg-card p-5 ${status === "ended" && !completion ? "opacity-60" : ""}`}>
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
            {completion?.status === "approved" ? "✓" : `${Math.round(p.pct)}%`}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold">
            {p.value} / {p.goal} {p.unit}
          </div>
          <div className="mt-0.5 text-[11.5px] font-semibold text-ink-soft">{statusText}</div>
        </div>
      </div>

      {completion?.status === "rejected" && completion.reviewNote && (
        <div className="mt-3 rounded-xl bg-red-soft px-3.5 py-2.5 text-[12px] font-semibold text-red-deep">
          Reviewer&apos;s note: {completion.reviewNote}
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5 text-[12px] font-semibold text-ink-soft">
        <span>
          {challenge.window_label}
          {window && <span className="text-ink"> · {window}</span>}
        </span>
        <span>
          {participants} runner{participants === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-2 text-[12px] font-semibold text-ink-soft">⭐ {challenge.points} pts on approval</div>
      <div className="mt-1.5 text-[12px] font-semibold text-ink-soft">
        {championName
          ? `🏆 Fastest: ${championName}`
          : `🏆 +${challenge.bonus} bonus pts for the first approved finisher`}
      </div>

      <button
        onClick={action.onClick}
        disabled={!action.onClick}
        className={`mt-4 w-full rounded-full py-3 text-[13.5px] font-bold transition disabled:cursor-default ${
          action.style === "primary"
            ? "bg-red text-white hover:opacity-90"
            : action.style === "done"
              ? "border border-line bg-bg-soft text-ink"
              : "border border-line bg-bg-soft text-ink-soft"
        }`}
      >
        {action.label}
      </button>
    </div>
  );
}
