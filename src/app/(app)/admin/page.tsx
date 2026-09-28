"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { challengeStatus, formatDate, timeAgo, toProgress } from "@/lib/progress";
import { PROOF_BUCKET } from "@/lib/storage";
import type { Database } from "@/lib/supabase/types";

type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ChallengeStatsRow = Database["public"]["Views"]["challenge_stats"]["Row"];
type Redemption = Database["public"]["Tables"]["redemptions"]["Row"] & {
  profiles: { name: string } | null;
  rewards: { name: string; emoji: string } | null;
};
type Review = Database["public"]["Tables"]["completions"]["Row"] & {
  profiles: { name: string; city: string | null } | null;
};
type ReviewRun = Pick<
  Database["public"]["Tables"]["runs"]["Row"],
  "runner_id" | "challenge_id" | "distance_km" | "date" | "source"
>;

interface AdminStats {
  runners: number;
  km: number;
  runs_this_week: number;
  challenges: number;
  points_issued: number;
  points_redeemed: number;
  pending: number;
  pending_reviews: number;
}

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
  startsAt: "",
  endsAt: "",
};

type FormState = typeof emptyForm;

function formFromChallenge(c: Challenge): FormState {
  return {
    title: c.title,
    emoji: c.emoji,
    metric: c.metric,
    goal: String(c.goal),
    description: c.description,
    windowLabel: c.window_label,
    points: String(c.points),
    bonus: String(c.bonus),
    startsAt: c.starts_at ?? "",
    endsAt: c.ends_at ?? "",
  };
}

const inputClass = "w-full rounded-xl border border-line bg-bg-soft px-3.5 py-2.5 text-[14px]";
const labelClass = "mb-1.5 block text-[12px] font-bold text-ink-soft";

export default function AdminPage() {
  const router = useRouter();
  const { supabase, profile, loading: authLoading } = useSupabase();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeStats, setChallengeStats] = useState<Map<string, ChallengeStatsRow>>(new Map());
  const [signups, setSignups] = useState<Profile[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRuns, setReviewRuns] = useState<ReviewRun[]>([]);
  const [reviewProgress, setReviewProgress] = useState<Map<string, number>>(new Map());
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [dataLoading, setDataLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && profile && !profile.is_admin) {
      router.replace("/challenges");
    }
  }, [authLoading, profile, router]);

  const loadAll = useCallback(async () => {
    const [st, c, cs, p, red, rv] = await Promise.all([
      supabase.rpc("admin_stats"),
      supabase.from("challenges").select("*").order("sort_order"),
      supabase.from("challenge_stats").select("*"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(15),
      supabase
        .from("redemptions")
        .select("*, profiles(name), rewards(name, emoji)")
        .order("redeemed_at", { ascending: false })
        .limit(200),
      // Oldest first — review_completion() requires that order per challenge.
      supabase
        .from("completions")
        .select("*, profiles(name, city)")
        .eq("status", "pending")
        .order("submitted_at", { ascending: true })
        .limit(50),
    ]);
    const firstError = st.error ?? c.error ?? cs.error ?? p.error ?? red.error ?? rv.error;
    if (firstError) setActionError(`Couldn't load everything: ${firstError.message}`);

    const pending = (rv.data as unknown as Review[]) ?? [];
    const runnerIds = [...new Set(pending.map((r) => r.runner_id))];
    const challengeIds = [...new Set(pending.map((r) => r.challenge_id))];
    const paths = pending.flatMap((r) => [r.photo_path, r.proof_path]).filter((x): x is string => !!x);

    // Evidence for each pending submission: the runner's runs and progress
    // on that challenge, plus short-lived links to the private photos.
    const [runsRes, progRes, urlsRes] = await Promise.all([
      runnerIds.length
        ? supabase
            .from("runs")
            .select("runner_id, challenge_id, distance_km, date, source")
            .in("runner_id", runnerIds)
            .in("challenge_id", challengeIds)
            .order("date")
        : Promise.resolve({ data: [] as ReviewRun[] }),
      runnerIds.length
        ? supabase.from("challenge_progress").select("*").in("runner_id", runnerIds)
        : Promise.resolve({ data: [] as Database["public"]["Views"]["challenge_progress"]["Row"][] }),
      paths.length
        ? supabase.storage.from(PROOF_BUCKET).createSignedUrls(paths, 60 * 60)
        : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    ]);

    setStats((st.data as unknown as AdminStats) ?? null);
    setChallenges(c.data ?? []);
    setChallengeStats(new Map((cs.data ?? []).map((row) => [row.challenge_id, row])));
    setSignups(p.data ?? []);
    setRedemptions((red.data as unknown as Redemption[]) ?? []);
    setReviews(pending);
    setReviewRuns(runsRes.data ?? []);
    setReviewProgress(
      new Map((progRes.data ?? []).map((row) => [`${row.runner_id}:${row.challenge_id}`, Number(row.progress)])),
    );
    const urlEntries: [string, string][] = [];
    for (const u of urlsRes.data ?? []) {
      if (u.path && u.signedUrl) urlEntries.push([u.path, u.signedUrl]);
    }
    setPhotoUrls(new Map(urlEntries));
    setDataLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (profile?.is_admin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
      loadAll();
    }
  }, [profile?.is_admin, loadAll]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: Challenge) {
    setEditingId(c.id);
    setForm(formFromChallenge(c));
    setFormError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
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
    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
      return setFormError("End date can't be before the start date.");
    }

    const fields = {
      title: form.title.trim(),
      emoji: form.emoji.trim() || "🏃",
      metric: form.metric,
      goal,
      description: form.description.trim(),
      window_label: form.windowLabel.trim() || "Anytime",
      points,
      bonus,
      starts_at: form.startsAt || null,
      ends_at: form.endsAt || null,
    };

    setSubmitting(true);
    const { data, error } = editingId
      ? await supabase.from("challenges").update(fields).eq("id", editingId).select("id")
      : await supabase
          .from("challenges")
          .insert({ ...fields, id: slugify(form.title), sort_order: challenges.length + 1 })
          .select("id");
    setSubmitting(false);

    if (error) {
      setFormError(
        error.code === "23505"
          ? "A challenge with a very similar title already exists — try a different title."
          : error.message,
      );
      return;
    }
    if (!data || data.length === 0) {
      setFormError("The save was rejected — make sure you're signed in as an admin.");
      return;
    }

    closeForm();
    loadAll();
  }

  async function handleArchive(c: Challenge, archived: boolean) {
    setActionError(null);
    setBusyId(c.id);
    const { data, error } = await supabase.from("challenges").update({ archived }).eq("id", c.id).select("id");
    setBusyId(null);
    if (error || !data?.length) {
      setActionError(`Couldn't ${archived ? "archive" : "restore"} "${c.title}": ${error?.message ?? "not allowed"}`);
      return;
    }
    loadAll();
  }

  async function handleDelete(c: Challenge) {
    if (!window.confirm(`Permanently delete "${c.title}"? This can't be undone.`)) return;
    setActionError(null);
    setBusyId(c.id);
    const { data, error } = await supabase.from("challenges").delete().eq("id", c.id).select("id");
    setBusyId(null);
    if (error?.code === "23503") {
      setActionError(`"${c.title}" has runs logged against it, so it can't be deleted. Archive it instead.`);
      return;
    }
    if (error || !data?.length) {
      setActionError(`Couldn't delete "${c.title}": ${error?.message ?? "not allowed"}`);
      return;
    }
    loadAll();
  }

  async function handleReview(r: Review, approve: boolean) {
    const note = (reviewNotes[r.id] ?? "").trim();
    if (!approve && !note && !window.confirm("Reject without a note? The runner won't know what to fix.")) return;
    setActionError(null);
    setBusyId(r.id);
    const { error } = await supabase.rpc("review_completion", {
      p_completion_id: r.id,
      p_approve: approve,
      p_note: note || null,
    });
    setBusyId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    setReviewNotes(({ [r.id]: _removed, ...rest }) => rest);
    loadAll();
  }

  async function handleUpdateRedemptionStatus(id: string, status: string) {
    setActionError(null);
    setBusyId(id);
    const { data, error } = await supabase.from("redemptions").update({ status }).eq("id", id).select("id");
    setBusyId(null);
    if (error || !data?.length) {
      setActionError(`Couldn't update that redemption: ${error?.message ?? "not allowed"}`);
    }
    loadAll();
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

      {actionError && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl bg-red-soft px-4 py-3 text-[13px] font-semibold text-red-deep">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Dismiss" className="flex-none">
            ✕
          </button>
        </div>
      )}

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
              { l: "Runners joined", v: stats?.runners },
              { l: "Km logged", v: stats?.km },
              { l: "Runs this week", v: stats?.runs_this_week },
              { l: "Open challenges", v: stats?.challenges },
              { l: "Points issued", v: stats?.points_issued },
              { l: "Points redeemed", v: stats?.points_redeemed },
              { l: "Pending redemptions", v: stats?.pending },
              { l: "Proofs to review", v: stats?.pending_reviews },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-line bg-bg-card p-4">
                <div className="text-[26px] font-extrabold">{s.v ?? "—"}</div>
                <div className="mt-1 text-[11.5px] font-semibold text-ink-soft">{s.l}</div>
              </div>
            ))}
          </div>

          {/* ---------- Completion reviews ---------- */}
          <h2 className="mt-10 mb-1 text-[19px] font-extrabold">
            Proofs to review{reviews.length > 0 ? ` (${reviews.length})` : ""}
          </h2>
          <p className="mb-4 text-[12.5px] font-medium text-ink-soft">
            Oldest first. Approving awards the points — and the champion bonus to the first approved finisher of
            each challenge.
          </p>
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-line bg-bg-card p-8 text-center text-[13.5px] text-ink-soft">
              Nothing waiting for review.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => {
                const challenge = challenges.find((c) => c.id === r.challenge_id);
                const runs = reviewRuns.filter((x) => x.runner_id === r.runner_id && x.challenge_id === r.challenge_id);
                const progressValue = reviewProgress.get(`${r.runner_id}:${r.challenge_id}`) ?? 0;
                const p = challenge ? toProgress(challenge, progressValue) : null;
                const photos = [
                  { label: "Finish-line photo", path: r.photo_path },
                  { label: "Tracker screenshot", path: r.proof_path },
                ].filter((x) => x.path);
                return (
                  <div key={r.id} className="rounded-2xl border border-line bg-bg-card p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-[15px] font-extrabold">
                        {r.profiles?.name ?? "Runner"}
                        {r.profiles?.city ? <span className="font-medium text-ink-soft"> · {r.profiles.city}</span> : null}
                      </div>
                      <div className="text-[12px] font-medium text-ink-soft">
                        Submitted {r.submitted_at ? timeAgo(r.submitted_at) : "—"}
                      </div>
                    </div>
                    <div className="mt-1 text-[13px] font-semibold">
                      {challenge?.emoji} {challenge?.title ?? r.challenge_id}
                      {p && (
                        <span className={p.done ? "text-ink-soft" : "text-red-deep"}>
                          {" "}
                          · {p.value} / {p.goal} {p.unit}
                          {!p.done && " — below goal (goal or dates may have changed)"}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {photos.map((ph) => {
                        const url = photoUrls.get(ph.path!);
                        return (
                          <div key={ph.label}>
                            <div className="mb-1.5 text-[11.5px] font-bold text-ink-soft">{ph.label}</div>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-bg-soft">
                                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL to a private file; not suitable for next/image caching */}
                                <img src={url} alt={ph.label} className="max-h-80 w-full object-contain" />
                              </a>
                            ) : (
                              <div className="rounded-xl bg-bg-soft p-6 text-center text-[12px] text-ink-soft">
                                Couldn&apos;t load this file.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <details className="mt-4">
                      <summary className="cursor-pointer text-[12.5px] font-bold text-ink-soft">
                        {runs.length} run{runs.length === 1 ? "" : "s"} logged for this challenge
                      </summary>
                      <div className="mt-2 space-y-1 text-[12.5px] font-medium text-ink-soft">
                        {runs.map((run, i) => (
                          <div key={i}>
                            {formatDate(run.date)} · {run.distance_km} km · {run.source}
                          </div>
                        ))}
                      </div>
                    </details>

                    <textarea
                      value={reviewNotes[r.id] ?? ""}
                      onChange={(e) => setReviewNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Note to the runner (shown if you reject)"
                      maxLength={200}
                      className={`${inputClass} mt-4 min-h-[50px] resize-y text-[13px]`}
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        onClick={() => handleReview(r, true)}
                        disabled={busyId === r.id}
                        className="flex-1 rounded-full bg-red py-2.5 text-[13px] font-bold text-white transition disabled:opacity-50"
                      >
                        Approve · {challenge?.points ?? r.points} pts
                      </button>
                      <button
                        onClick={() => handleReview(r, false)}
                        disabled={busyId === r.id}
                        className="flex-1 rounded-full border border-line bg-bg-soft py-2.5 text-[13px] font-bold text-ink transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------- Challenges ---------- */}
          <div className="mt-10 mb-4 flex items-center justify-between">
            <h2 className="text-[19px] font-extrabold">Challenges</h2>
            <button
              onClick={() => (showForm ? closeForm() : openCreate())}
              className="rounded-full bg-red px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90"
            >
              {showForm ? "Cancel" : "+ New challenge"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-5 rounded-2xl border border-line bg-bg-card p-5">
              <div className="mb-4 text-[14px] font-extrabold">
                {editingId ? `Editing "${form.title}"` : "New challenge"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Winter 10K"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Emoji</label>
                  <input
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    maxLength={4}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Metric</label>
                  <select
                    value={form.metric}
                    onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as FormState["metric"] }))}
                    className={inputClass}
                  >
                    {METRICS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Goal</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.goal}
                    onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={`${inputClass} min-h-[60px] resize-y`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Starts (optional)</label>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Ends (optional, inclusive)</label>
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Window label (shown on the card)</label>
                  <input
                    value={form.windowLabel}
                    onChange={(e) => setForm((f) => ({ ...f, windowLabel: e.target.value }))}
                    placeholder="e.g. This month"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Points</label>
                    <input
                      type="number"
                      min="0"
                      value={form.points}
                      onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Bonus</label>
                    <input
                      type="number"
                      min="0"
                      value={form.bonus}
                      onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[12px] font-medium text-ink-soft">
                Only runs dated inside the start/end dates count. Leave both empty for an open-ended challenge.
                {editingId && " Changing the goal or dates doesn't take back badges already awarded."}
              </p>
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
                {submitting ? "Saving…" : editingId ? "Save changes" : "Create challenge"}
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-line bg-bg-card p-2">
            {challenges.length === 0 ? (
              <div className="p-8 text-center text-[13.5px] text-ink-soft">No challenges yet.</div>
            ) : (
              challenges.map((c) => {
                const s = challengeStats.get(c.id);
                const participants = Number(s?.participants ?? 0);
                const completions = Number(s?.completions ?? 0);
                const status = c.archived ? "archived" : challengeStatus(c);
                const dates =
                  c.starts_at || c.ends_at
                    ? `${c.starts_at ? formatDate(c.starts_at) : "…"} → ${c.ends_at ? formatDate(c.ends_at) : "…"}`
                    : "No end date";
                return (
                  <div
                    key={c.id}
                    className={`flex flex-wrap items-center gap-4 border-b border-line px-3 py-3 last:border-0 ${
                      c.archived ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-red-soft text-[18px]">
                      {c.emoji}
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <div className="font-bold">
                        {c.title}
                        <span className="ml-2 rounded-full border border-line bg-bg-soft px-2 py-0.5 text-[10.5px] font-bold uppercase text-ink-soft">
                          {status}
                        </span>
                      </div>
                      <div className="text-[11.5px] font-medium text-ink-soft">
                        {dates} · {participants} runner{participants === 1 ? "" : "s"} · {completions} completion
                        {completions === 1 ? "" : "s"} · {c.points} pts + {c.bonus} bonus
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[12px] font-semibold">
                      <button
                        onClick={() => openEdit(c)}
                        disabled={busyId === c.id}
                        className="text-ink-soft hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchive(c, !c.archived)}
                        disabled={busyId === c.id}
                        className="text-ink-soft hover:text-ink"
                      >
                        {c.archived ? "Restore" : "Archive"}
                      </button>
                      {participants === 0 && completions === 0 && (
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={busyId === c.id}
                          className="text-ink-soft hover:text-red-deep"
                        >
                          Delete
                        </button>
                      )}
                    </div>
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
                    disabled={busyId === r.id}
                    className="rounded-full border border-line bg-bg-soft px-3 py-1.5 text-[12px] font-semibold"
                  >
                    <option value="Requested">Requested</option>
                    <option value="Fulfilled">Fulfilled</option>
                    <option value="Rejected">Rejected (refunds points)</option>
                  </select>
                </div>
              ))
            )}
          </div>

          {/* ---------- Recent signups ---------- */}
          <h2 className="mt-10 mb-4 text-[19px] font-extrabold">Recent signups</h2>
          <div className="rounded-2xl border border-line bg-bg-card p-2">
            {signups.map((p) => (
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
