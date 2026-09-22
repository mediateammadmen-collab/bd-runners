"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import type { Database } from "@/lib/supabase/types";

type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
type RunRow = Database["public"]["Tables"]["runs"]["Row"];
type CompletionRow = Database["public"]["Tables"]["completions"]["Row"];
type ChampionRow = Database["public"]["Tables"]["champions"]["Row"];

export type RunWithProfile = RunRow & { profiles: { name: string } | null };
export type CompletionWithProfile = CompletionRow & { profiles: { name: string } | null };
export type ChampionWithProfile = ChampionRow & { profiles: { name: string } | null };

export function useCommunityData() {
  const { supabase } = useSupabase();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [runs, setRuns] = useState<RunWithProfile[]>([]);
  const [completions, setCompletions] = useState<CompletionWithProfile[]>([]);
  const [champions, setChampions] = useState<ChampionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: c }, { data: r }, { data: comp }, { data: champ }] = await Promise.all([
      supabase.from("challenges").select("*").order("sort_order"),
      supabase
        .from("runs")
        .select("*, profiles(name)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("completions").select("*, profiles(name)"),
      supabase.from("champions").select("*, profiles(name)"),
    ]);
    setChallenges(c ?? []);
    setRuns((r as unknown as RunWithProfile[]) ?? []);
    setCompletions((comp as unknown as CompletionWithProfile[]) ?? []);
    setChampions((champ as unknown as ChampionWithProfile[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + realtime subscription on mount
    load();

    // A unique-per-mount topic avoids realtime-js returning the previous,
    // already-subscribed channel instance when effects re-run (e.g. React
    // Strict Mode's double-invoke in development), which throws "cannot add
    // postgres_changes callbacks after subscribe()".
    const channel = supabase
      .channel(`community-data-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "champions" }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  return { challenges, runs, completions, champions, loading, refresh: load };
}
