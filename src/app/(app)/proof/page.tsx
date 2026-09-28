"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { compressImage } from "@/lib/compress-image";
import { PROOF_BUCKET } from "@/lib/storage";
import type { Database } from "@/lib/supabase/types";

type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
type Completion = Pick<
  Database["public"]["Tables"]["completions"]["Row"],
  "status" | "review_note" | "points"
>;

function PhotoPicker({
  label,
  hint,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div>
      <div className="mb-1 text-[13px] font-bold">{label}</div>
      <p className="mb-2.5 text-[12.5px] font-medium text-ink-soft">{hint}</p>
      <label className="flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-bg-soft text-center transition hover:border-red">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview; next/image can't optimize blob: URLs
          <img src={preview} alt={`${label} preview`} className="max-h-72 w-full object-contain" />
        ) : (
          <div className="px-4 py-10 text-[13px] font-semibold text-ink-soft">📷 Tap to choose a photo</div>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button type="button" onClick={() => onChange(null)} className="mt-2 text-[12px] font-semibold text-ink-soft hover:text-ink">
          Remove
        </button>
      )}
    </div>
  );
}

function ProofForm() {
  const { supabase, user } = useSupabase();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge") ?? "";

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [tracker, setTracker] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user || !challengeId) return;
    let active = true;
    Promise.all([
      supabase.from("challenges").select("*").eq("id", challengeId).maybeSingle(),
      supabase
        .from("completions")
        .select("status, review_note, points")
        .eq("challenge_id", challengeId)
        .eq("runner_id", user.id)
        .maybeSingle(),
    ]).then(([c, comp]) => {
      if (!active) return;
      setChallenge(c.data ?? null);
      setCompletion(comp.data ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [supabase, user, challengeId]);

  const needsTracker = challenge?.metric === "distance_km" || challenge?.metric === "single_run_km";

  async function upload(file: File, kind: "photo" | "tracker") {
    const blob = await compressImage(file);
    const path = `${user!.id}/${challengeId}/${Date.now()}-${kind}.jpg`;
    const { error } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return path;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!photo) return setError("Please add your finish-line photo.");
    if (needsTracker && !tracker) return setError("Please add a screenshot from your tracker showing the distance.");

    setSubmitting(true);
    try {
      const photoPath = await upload(photo, "photo");
      const trackerPath = tracker ? await upload(tracker, "tracker") : null;
      const { error } = await supabase.rpc("submit_completion_proof", {
        p_challenge_id: challengeId,
        p_photo_path: photoPath,
        p_proof_path: trackerPath,
      });
      if (error) throw new Error(error.message);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const card = "max-w-[560px] rounded-2xl border border-line bg-bg-card p-6";

  if (!challengeId) {
    return <div className={card}>No challenge selected. <Link href="/challenges" className="font-bold text-red">Back to challenges</Link></div>;
  }
  if (loading) {
    return <div className="py-20 text-center text-[14px] text-ink-soft">Loading…</div>;
  }
  if (!challenge) {
    return <div className={card}>That challenge doesn&apos;t exist. <Link href="/challenges" className="font-bold text-red">Back to challenges</Link></div>;
  }

  const header = (
    <div className="mb-6">
      <h1 className="text-[22px] font-extrabold">
        {challenge.emoji} Claim {challenge.title}
      </h1>
      <p className="mt-1 text-[13.5px] font-medium text-ink-soft">
        An admin checks every submission before points are awarded.
      </p>
    </div>
  );

  if (submitted || completion?.status === "pending") {
    return (
      <section>
        {header}
        <div className={card}>
          <div className="text-[17px] font-extrabold">⏳ Submitted — under review</div>
          <p className="mt-2 text-[13.5px] font-medium text-ink-soft">
            You&apos;ll get your {completion?.points ?? challenge.points} pts and badge once an admin approves it.
            Keep an eye on the Challenges page.
          </p>
          <Link href="/challenges" className="mt-5 inline-block rounded-full bg-red px-6 py-2.5 text-[13px] font-bold text-white">
            Back to challenges
          </Link>
        </div>
      </section>
    );
  }

  if (!completion) {
    return (
      <section>
        {header}
        <div className={card}>
          You haven&apos;t reached this challenge&apos;s goal yet — keep logging runs.{" "}
          <Link href={`/log?challenge=${challenge.id}`} className="font-bold text-red">Log a run</Link>
        </div>
      </section>
    );
  }

  if (completion.status === "approved") {
    return (
      <section>
        {header}
        <div className={card}>
          🏅 Already approved — you earned {completion.points} pts.{" "}
          <Link href="/badges" className="font-bold text-red">See your badges</Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      {header}
      <form onSubmit={handleSubmit} className={`${card} space-y-6`}>
        {completion.status === "rejected" && (
          <div className="rounded-xl bg-red-soft px-4 py-3 text-[13px] font-semibold text-red-deep">
            Your last submission was rejected{completion.review_note ? `: ${completion.review_note}` : "."} Please try
            again with clearer photos.
          </div>
        )}

        <PhotoPicker
          label="Finish-line photo"
          hint="A photo of you at the end of your run — your face should be clearly visible."
          file={photo}
          onChange={setPhoto}
        />

        {needsTracker && (
          <PhotoPicker
            label="Tracker screenshot"
            hint={
              challenge.metric === "single_run_km"
                ? "A screenshot from Strava, Garmin, Apple Health, etc. showing this run's distance and date."
                : "A screenshot from Strava, Garmin, Apple Health, etc. showing your distance for this challenge."
            }
            file={tracker}
            onChange={setTracker}
          />
        )}

        <p className="text-[12px] font-medium text-ink-soft">
          Photos are private — only you and Bd Runner admins can see them. They&apos;re resized before upload.
        </p>

        {error && (
          <div className="rounded-xl bg-red-soft px-4 py-3 text-[13px] font-semibold text-red-deep">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-red py-3.5 text-[14.5px] font-bold text-white transition disabled:opacity-50"
        >
          {submitting ? "Uploading…" : "Submit for review"}
        </button>
      </form>
    </section>
  );
}

export default function ProofPage() {
  return (
    <Suspense fallback={null}>
      <ProofForm />
    </Suspense>
  );
}
