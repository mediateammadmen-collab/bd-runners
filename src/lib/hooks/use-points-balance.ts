"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";

export function usePointsBalance() {
  const { supabase, user } = useSupabase();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const userId = user.id;

    async function load() {
      const [{ data: completions }, { data: redemptions }] = await Promise.all([
        supabase.from("completions").select("points").eq("runner_id", userId),
        supabase.from("redemptions").select("points_cost").eq("runner_id", userId),
      ]);
      if (!active) return;
      const earned = (completions ?? []).reduce((s, c) => s + c.points, 0);
      const spent = (redemptions ?? []).reduce((s, r) => s + r.points_cost, 0);
      setBalance(earned - spent);
      setLoading(false);
    }

    load();

    // A unique-per-mount topic avoids realtime-js returning the previous,
    // already-subscribed channel instance when effects re-run (e.g. React
    // Strict Mode's double-invoke in development), which throws "cannot add
    // postgres_changes callbacks after subscribe()".
    const channel = supabase
      .channel(`points-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "completions", filter: `runner_id=eq.${userId}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "redemptions", filter: `runner_id=eq.${userId}` },
        load,
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  return { balance: user ? balance : 0, loading: user ? loading : false };
}
