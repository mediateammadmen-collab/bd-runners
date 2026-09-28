import type { Database } from "@/lib/supabase/types";

export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];

export interface Progress {
  value: number;
  goal: number;
  unit: string;
  pct: number;
  done: boolean;
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// `value` comes from the challenge_progress view, which already applies the
// metric (sum / distinct days / best single run) and the date window.
export function toProgress(challenge: Challenge, value: number): Progress {
  const goal = Number(challenge.goal);
  const days = challenge.metric === "distinct_days";
  const v = days ? Math.round(value) : round1(value);
  return {
    value: v,
    goal,
    unit: days ? "days" : "km",
    pct: goal > 0 ? Math.min(100, (v / goal) * 100) : 0,
    done: v >= goal,
  };
}

// All calendar dates in the app are Bangladesh dates, matching log_run() in
// the database. Using UTC here would make "today" wrong between 00:00 and
// 06:00 Dhaka time.
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type ChallengeStatus = "upcoming" | "active" | "ended";

export function challengeStatus(
  c: Pick<Challenge, "starts_at" | "ends_at">,
  today: string = todayISO(),
): ChallengeStatus {
  if (c.starts_at && today < c.starts_at) return "upcoming";
  if (c.ends_at && today > c.ends_at) return "ended";
  return "active";
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function windowText(c: Pick<Challenge, "starts_at" | "ends_at">): string | null {
  const status = challengeStatus(c);
  if (status === "upcoming" && c.starts_at) return `Starts ${formatDate(c.starts_at)}`;
  if (status === "ended" && c.ends_at) return `Ended ${formatDate(c.ends_at)}`;
  if (c.ends_at) return `Ends ${formatDate(c.ends_at)}`;
  return null;
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
