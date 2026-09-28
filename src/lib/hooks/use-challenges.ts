"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import type { Challenge } from "@/lib/progress";
import type { CompletionStatus } from "@/lib/supabase/types";

export interface ChallengeStats {
  participants: number;
  completions: number;
}

export interface MyCompletion {
  points: number;
  champion: boolean;
  status: CompletionStatus;
  reviewNote: string | null;
}

// Everything the Challenges and Badges pages need, read from database-side
// aggregates (challenge_progress / challenge_stats) so the numbers stay right
// no matter how many runs exist. `challenges` includes archived ones; callers
// decide whether to show them.
export function useChallenges() {
  const { supabase, user } = useSupabase();
  const userId = user?.id ?? null;

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Map<string, ChallengeStats>>(new Map());
  const [champions, setChampions] = useState<Map<string, string>>(new Map());
  const [myProgress, setMyProgress] = useState<Map<string, number>>(new Map());
  const [myCompletions, setMyCompletions] = useState<Map<string, MyCompletion>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }, { data: ch }] = await Promise.all([
      supabase.from("challenges").select("*").order("sort_order"),
      supabase.from("challenge_stats").select("*"),
      supabase.from("champions").select("challenge_id, profiles(name)"),
    ]);

    setChallenges(c ?? []);
    setStats(
      new Map(
        (s ?? []).map((row) => [
          row.challenge_id,
          { participants: Number(row.participants), completions: Number(row.completions) },
        ]),
      ),
    );
    const champRows = (ch ?? []) as unknown as { challenge_id: string; profiles: { name: string } | null }[];
    setChampions(new Map(champRows.map((row) => [row.challenge_id, row.profiles?.name ?? "A runner"])));

    if (userId) {
      const [{ data: mp }, { data: mc }] = await Promise.all([
        supabase.from("challenge_progress").select("challenge_id, progress").eq("runner_id", userId),
        supabase
          .from("completions")
          .select("challenge_id, points, champion, status, review_note")
          .eq("runner_id", userId),
      ]);
      setMyProgress(new Map((mp ?? []).map((row) => [row.challenge_id, Number(row.progress)])));
      setMyCompletions(
        new Map(
          (mc ?? []).map((row) => [
            row.challenge_id,
            { points: row.points, champion: row.champion, status: row.status, reviewNote: row.review_note },
          ]),
        ),
      );
    }

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + realtime subscription on mount
    load();

    // Unique per mount: realtime-js reuses a channel with the same topic, and
    // re-adding listeners to an already-subscribed channel throws.
    const channel = supabase
      .channel(`challenges-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "champions" }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  return { challenges, stats, champions, myProgress, myCompletions, loading, refresh: load };
}
