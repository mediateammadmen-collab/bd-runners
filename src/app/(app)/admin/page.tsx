"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { timeAgo, weekAgoTimestamp } from "@/lib/progress";
import type { Database } from "@/lib/supabase/types";

type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type RunRow = { distance_km: number; created_at: string };
type CompletionRow = { challenge_id: string; points: number; champion: boolean };
type Redemption = Database["public"]["Tables"]["redemptions"]["Row"] & {
  profiles: { name: string } | null;
  rewards: { name: string; emoji: string } | null;
};

const METRICS = [
  { value: "distance_km", label: "Total distance (km)" },
  { value: "distinct_days", label: "Distinct days run" },
  { value: "single_run_km", label: "Single run distance (km)" },
] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const emptyForm = {
  title: "",
  emoji: "🏃",
  metric: "distance_km" as (typeof METRICS)[number]["value"],
  goal: "",
  description: "",
  windowLabel: "This month",
  points: "",
  bonus: "",
};

export default function AdminPage() {
  const router = useRouter();
  const { supabase, profile, loading: authLoading } = useSupabase();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redeemUpdating, setRedeemUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && profile && !profile.is_admin) {
      router.replace("/challenges");
    }
  }, [authLoading, profile, router]);

  const loadAll = useCallback(async () => {
    const [{ data: c }, { data: p }, { data: r }, { data: comp }, { data: red }] = await Promise.all([
      supabase.from("challenges").select("*").order("sort_order"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("runs").select("distance_km, created_at"),
      supabase.from("completions").select("challenge_id, points, champion"),
      supabase
        .from("redemptions")
        .select("*, profiles(name), rewards(name, emoji)")
        .order("redeemed_at", { ascending: false }),
    ]);
    setChallenges(c ?? []);
    setProfiles(p ?? []);
    setRuns(r ?? []);
    setCompletions(comp ?? []);
    setRedemptions((red as unknown as Redemption[]) ?? []);
    setDataLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (profile?.is_admin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
      loadAll();
    }
  }, [profile?.is_admin, loadAll]);

  const stats = useMemo(() => {
    const totalKm = runs.reduce((s, r) => s + Number(r.distance_km), 0);
    const weekAgo = weekAgoTimestamp();
    const runsThisWeek = runs.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length;
    const pointsIssued = completions.reduce((s, c) => s + c.points, 0);
    const pointsRedeemed = redemptions.reduce((s, r) => s + r.points_cost, 0);
    const pending = redemptions.filter((r) => r.status === "Requested").length;
    return {
      runners: profiles.length,
      km: Math.round(totalKm),
      runsThisWeek,
      challenges: challenges.length,
      pointsIssued,
      pointsRedeemed,
      pending,
    };
  }, [runs, profiles, completions, redemptions, challenges]);

  const completionsByChallenge = useMemo(() => {
    const map = new Map<string, { count: number; champions: number }>();
    completions.forEach((c) => {
      const entry = map.get(c.challenge_id) ?? { count: 0, champions: 0 };
      entry.count += 1;
      if (c.champion) entry.champions += 1;
      map.set(c.challenge_id, entry);
    });
    return map;
  }, [completions]);

  async function handleCreateChallenge(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const goal = parseFloat(form.goal);
    const points = parseInt(form.points, 10);
    const bonus = parseInt(form.bonus, 10);

    if (!form.title.trim()) return setFormError("Title is required.");
    if (!goal || goal <= 0) return setFormError("Goal must be greater than 0.");
    if (!form.description.trim()) return setFormError("Description is required.");
    if (Number.isNaN(points) || points < 0) return setFormError("Points must be 0 or more.");
    if (Number.isNaN(bonus) || bonus < 0) return setFormError("Bonus must be 0 or more.");

    const id = slugify(form.title);
    setSubmitting(true);
    const { error } = await supabase.from("challenges").insert({
      id,
      title: form.title.trim(),
      emoji: form.emoji.trim() || "🏃",
      metric: form.metric,
      goal,
      description: form.description.trim(),
      window_label: form.windowLabel.trim() || "Anytime",
      points,
      bonus,
      sort_order: challenges.length + 1,
    });
    setSubmitting(false);

    if (error) {
      setFormError(
        error.message.includes("duplicate")
          ? "A challenge with a very similar title already exists — try a different title."
          : error.message,
      );
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    loadAll();
  }

  async function handleDeleteChallenge(id: string) {
    if (!window.confirm("Delete this challenge? Existing runs logged against it will keep their history.")) {
      return;
    }
    await supabase.from("challenges").delete().eq("id", id);
    loadAll();
  }

  async function handleUpdateRedemptionStatus(id: string, status: string) {
    setRedeemUpdating(id);
    await supabase.from("redemptions").update({ status }).eq("id", id);
    await loadAll();
    setRedeemUpdating(null);
  }

  if (authLoading || !profile) {
    return <div className="py-20 text-center text-[14px] text-ink-soft">Loading…</div>;
  }

  if (!profile.is_admin) {
    return null;
  }

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-[22px] font-extrabold">Admin</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">
          Platform stats, challenge management, and redemption requests.
        </p>
      </div>

      {dataLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-bg-soft" />
          ))}
        </div>
      ) : (
        <>
          {/* ---------- Stats ---------- */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {[
              { l: "Runners joined", v: stats.runners },
              { l: "Km logged", v: stats.km },
              { l: "Runs this week", v: stats.runsThisWeek },
              { l: "Live challenges", v: stats.challenges },
              { l: "Points issued", v: stats.pointsIssued },
              { l: "Points redeemed", v: stats.pointsRedeemed },
              { l: "Pending redemptions", v: stats.pending },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-line bg-bg-card p-4">
                <div className="text-[26px] font-extrabold">{s.v}</div>
                <div className="mt-1 text-[11.5px] font-semibold text-ink-soft">{s.l}</div>
              </div>
            ))}
          </div>

          {/* ---------- Challenges ---------- */}
          <div className="mt-10 mb-4 flex items-center justify-between">
            <h2 className="text-[19px] font-extrabold">Challenges</h2>
            <button
              onClick={() => {
                setShowForm((v) => !v);
                setFormError(null);
              }}
              className="rounded-full bg-red px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90"
            >
              {showForm ? "Cancel" : "+ New challenge"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreateChallenge} className="mb-5 rounded-2xl border border-line bg-bg-card p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Winter 10K"
                    className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Emoji</label>
                  <input
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    maxLength={4}
                    className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Metric</label>
                  <select
                    value={form.metric}
                    onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as typeof f.metric }))}
                    className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                  >
                    {METRICS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Goal</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.goal}
                    onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="min-h-[60px] w-full resize-y rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Window label</label>
                  <input
                    value={form.windowLabel}
                    onChange={(e) => setForm((f) => ({ ...f, windowLabel: e.target.value }))}
                    placeholder="e.g. This month"
                    className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Points</label>
                    <input
                      type="number"
                      min="0"
                      value={form.points}
                      onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Bonus</label>
                    <input
                      type="number"
                      min="0"
                      value={form.bonus}
                      onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]"
                    />
                  </div>
                </div>
              </div>
              {formError && (
                <div className="mt-3 rounded-xl bg-red-soft px-4 py-2.5 text-[12.5px] font-semibold text-red-deep">
                  {formError}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="mt-4 rounded-full bg-red px-6 py-2.5 text-[13px] font-bold text-white transition disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create challenge"}
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-line bg-bg-card p-2">
            {challenges.length === 0 ? (
              <div className="p-8 text-center text-[13.5px] text-ink-soft">No challenges yet.</div>
            ) : (
              challenges.map((c) => {
                const stat = completionsByChallenge.get(c.id);
                return (
                  <div key={c.id} className="flex items-center gap-4 border-b border-line px-3 py-3 last:border-0">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-red-soft text-[18px]">
                      {c.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold">{c.title}</div>
                      <div className="text-[11.5px] font-medium text-ink-soft">
                        {stat?.count ?? 0} completion{stat?.count === 1 ? "" : "s"}
                        {stat?.champions ? " · 🏆 champion claimed" : ""} · {c.points} pts + {c.bonus} bonus
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteChallenge(c.id)}
                      className="text-[12px] font-semibold text-ink-soft hover:text-red-deep"
                    >
                      Delete
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* ---------- Redemption requests ---------- */}
          <h2 className="mt-10 mb-4 text-[19px] font-extrabold">Redemption requests</h2>
          <div className="rounded-2xl border border-line bg-bg-card p-2">
            {redemptions.length === 0 ? (
              <div className="p-8 text-center text-[13.5px] text-ink-soft">No redemptions yet.</div>
            ) : (
              redemptions.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-3 last:border-0">
                  <div className="flex-1">
                    <div className="font-bold">
                      {r.rewards?.emoji} {r.rewards?.name ?? "Reward"} · {r.points_cost} pts
                    </div>
                    <div className="text-[11.5px] font-medium text-ink-soft">
                      {r.profiles?.name ?? "Runner"} · {timeAgo(r.redeemed_at)}
                    </div>
                  </div>
                  <select
                    value={r.status}
                    onChange={(e) => handleUpdateRedemptionStatus(r.id, e.target.value)}
                    disabled={redeemUpdating === r.id}
                    className="rounded-full border border-line bg-bg-soft px-3 py-1.5 text-[12px] font-semibold"
                  >
                    <option value="Requested">Requested</option>
                    <option value="Fulfilled">Fulfilled</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              ))
            )}
          </div>

          {/* ---------- Recent signups ---------- */}
          <h2 className="mt-10 mb-4 text-[19px] font-extrabold">Recent signups</h2>
          <div className="rounded-2xl border border-line bg-bg-card p-2">
            {profiles.slice(0, 15).map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
                <div className="flex-1 font-bold">
                  {p.name}
                  {p.is_admin ? " · admin" : ""}
                </div>
                <div className="text-[12px] font-medium text-ink-soft">{p.city || "—"}</div>
                <div className="text-[11.5px] font-medium text-ink-soft">{timeAgo(p.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
