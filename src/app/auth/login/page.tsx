"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthCard } from "@/components/auth/auth-card";

function LoginForm() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/challenges";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
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
    <AuthCard title="Welcome back" subtitle="Sign in to keep your streak going.">
      <GoogleButton onClick={handleGoogle} label="Continue with Google" />
      <div className="my-5 flex items-center gap-3 text-[11.5px] font-semibold text-ink-soft">
        <div className="h-px flex-1 bg-line" />
        or
        <div className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[15px]"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-red-soft px-4 py-3 text-[13px] font-semibold text-red-deep">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-full bg-red py-3.5 text-[14.5px] font-bold text-white transition disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-[13px] font-medium text-ink-soft">
        New here?{" "}
        <Link href="/auth/signup" className="font-bold text-red">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
