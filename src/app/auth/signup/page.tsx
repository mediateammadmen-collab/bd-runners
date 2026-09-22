"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthCard } from "@/components/auth/auth-card";

function SignupForm() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/challenges";

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, city } },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (!data.session) {
      setNotice("Check your inbox — we sent a confirmation link to finish creating your account.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <AuthCard title="Join the run" subtitle="Start earning points and racing the clock.">
      <GoogleButton onClick={handleGoogle} label="Continue with Google" />
      <div className="my-5 flex items-center gap-3 text-[11.5px] font-semibold text-ink-soft">
        <div className="h-px flex-1 bg-line" />
        or
        <div className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
              placeholder="Tanvir Ahmed"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="city">
              City / area
            </label>
            <input
              id="city"
              maxLength={40}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
              placeholder="Dhaka"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
            placeholder="At least 6 characters"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-red-soft px-4 py-3 text-[13px] font-semibold text-red-deep">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl bg-ink px-4 py-3 text-[13px] font-semibold text-white">{notice}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-full bg-red py-3.5 text-[14.5px] font-bold text-white transition disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Start running"}
        </button>
      </form>
      <p className="mt-6 text-center text-[13px] font-medium text-ink-soft">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-bold text-red">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
