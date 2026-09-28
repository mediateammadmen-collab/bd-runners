"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/supabase-provider";
import { usePointsBalance } from "@/lib/hooks/use-points-balance";

const TABS = [
  { href: "/challenges", label: "Challenges" },
  { href: "/log", label: "Log a Run" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/rewards", label: "Rewards" },
  { href: "/badges", label: "Badges" },
  { href: "/maps", label: "Maps" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { supabase, profile } = useSupabase();
  const { balance } = usePointsBalance();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-5 px-6 py-4 sm:px-10 lg:px-14">
          <Link href="/" className="flex flex-none items-center gap-2 text-[15px] font-extrabold">
            <span className="h-[9px] w-[9px] rounded-full bg-red" />
            Bd Runner
          </Link>
          <nav className="flex flex-1 justify-center gap-7 overflow-x-auto">
            {(profile?.is_admin ? [...TABS, { href: "/admin", label: "Admin" }] : TABS).map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`whitespace-nowrap border-b-2 pb-1.5 pt-1.5 text-[13.5px] font-semibold transition ${
                    active ? "border-red font-bold text-red" : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-none items-center gap-3">
            <div className="whitespace-nowrap rounded-full border border-line bg-bg-soft px-3.5 py-2 text-[12.5px] font-bold">
              👋 {profile?.name ?? "…"} · ⭐ {balance} pts
            </div>
            <button onClick={handleSignOut} className="text-[12.5px] font-semibold text-ink-soft hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10 lg:px-14">{children}</main>
    </div>
  );
}
