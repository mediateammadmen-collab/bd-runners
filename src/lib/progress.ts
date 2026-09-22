import type { Database } from "@/lib/supabase/types";

export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
export type Run = Database["public"]["Tables"]["runs"]["Row"];

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

export function progressFor(challenge: Challenge, runs: Run[]): Progress {
  if (challenge.metric === "distance_km") {
    const total = runs.reduce((sum, r) => sum + Number(r.distance_km), 0);
    return {
      value: round1(total),
      goal: Number(challenge.goal),
      unit: "km",
      pct: Math.min(100, (total / Number(challenge.goal)) * 100),
      done: total >= Number(challenge.goal),
    };
  }
  if (challenge.metric === "distinct_days") {
    const days = new Set(runs.map((r) => r.date)).size;
    return {
      value: days,
      goal: Number(challenge.goal),
      unit: "days",
      pct: Math.min(100, (days / Number(challenge.goal)) * 100),
      done: days >= Number(challenge.goal),
    };
  }
  const max = runs.reduce((m, r) => Math.max(m, Number(r.distance_km)), 0);
  return {
    value: round1(max),
    goal: Number(challenge.goal),
    unit: "km",
    pct: Math.min(100, (max / Number(challenge.goal)) * 100),
    done: max >= Number(challenge.goal),
  };
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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function weekAgoTimestamp(): number {
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}
