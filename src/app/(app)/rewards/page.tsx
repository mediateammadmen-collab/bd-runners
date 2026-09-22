"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import { usePointsBalance } from "@/lib/hooks/use-points-balance";
import { timeAgo } from "@/lib/progress";
import type { Database } from "@/lib/supabase/types";

type Reward = Database["public"]["Tables"]["rewards"]["Row"];
type Redemption = Database["public"]["Tables"]["redemptions"]["Row"] & {
  rewards: { name: string; emoji: string } | null;
};

export default function RewardsPage() {
  const { supabase, user } = useSupabase();
  const { balance, loading: balanceLoading } = usePointsBalance();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<Redemption[]>([]);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("redemptions")
      .select("*, rewards(name, emoji)")
      .eq("runner_id", user.id)
      .order("redeemed_at", { ascending: false });
    setHistory((data as unknown as Redemption[]) ?? []);
  }, [supabase, user]);

  useEffect(() => {
    supabase
      .from("rewards")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setRewards(data ?? []));
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadHistory();
  }, [loadHistory]);

  async function handleRedeem(reward: Reward) {
    setError(null);
    setRedeemingId(reward.id);
    const { error } = await supabase.rpc("redeem_reward", { p_reward_id: reward.id });
    setRedeemingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    loadHistory();
  }

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold">Rewards</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">
          Earn points by completing challenges, then unlock real rewards.
        </p>
      </div>

      <div className="rounded-[20px] bg-ink px-8 py-9 text-center text-white">
        <div className="text-[46px] font-extrabold">{balanceLoading ? "…" : balance}</div>
        <div className="mt-1 text-[12.5px] font-semibold opacity-80">Your points balance</div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl bg-red-soft px-4 py-3 text-[13px] font-semibold text-red-deep">
          {error}
        </div>
      )}

      <h2 className="mb-4 mt-8 text-[19px] font-extrabold">Unlock a reward</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {rewards.map((r) => {
          const can = balance >= r.cost;
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-bg-card p-5 text-left">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-red-soft text-[19px]">
                {r.emoji}
              </div>
              <h3 className="mt-2 text-[16.5px] font-extrabold">{r.name}</h3>
              <p className="mt-1 min-h-[34px] text-[13px] font-medium text-ink-soft">{r.description}</p>
              <div className="mt-3 border-t border-line pt-3 text-[12px] font-semibold text-ink-soft">
                ⭐ {r.cost} pts
              </div>
              <button
                onClick={() => handleRedeem(r)}
                disabled={!can || redeemingId === r.id}
                className={`mt-3.5 w-full rounded-full py-3 text-[13.5px] font-bold transition disabled:opacity-60 ${
                  can ? "bg-red text-white hover:opacity-90" : "cursor-default bg-bg-soft text-ink-soft"
                }`}
              >
                {redeemingId === r.id ? "Redeeming…" : can ? "Redeem" : "Not enough points"}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="mb-4 mt-9 text-[19px] font-extrabold">Your redemptions</h2>
      <div className="rounded-2xl border border-line bg-bg-card p-2">
        {history.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-ink-soft">
            No redemptions yet — earn points by finishing a challenge.
          </div>
        ) : (
          history.map((h) => (
            <div key={h.id} className="flex items-center gap-3.5 border-b border-line px-3 py-3 last:border-0">
              <div className="flex-1 font-bold">
                {h.rewards?.emoji} {h.rewards?.name ?? "Reward"}
              </div>
              <div className="mr-2.5 text-[12px] font-medium text-ink-soft">{timeAgo(h.redeemed_at)}</div>
              <span className="rounded-full border border-line bg-bg-soft px-2.5 py-1 text-[11px] font-bold text-ink-soft">
                {h.status}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
