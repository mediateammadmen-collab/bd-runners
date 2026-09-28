import { createClient } from "@/lib/supabase/server";
import { LandingClient } from "@/components/landing/landing-client";
import { todayISO } from "@/lib/progress";

interface PublicStats {
  runners: number;
  km: number;
  runs_this_week: number;
  challenges: number;
}

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: rawStats }, { data: challenges }, { data: rewards }] = await Promise.all([
    supabase.rpc("public_stats"),
    supabase
      .from("challenges")
      .select("*")
      .eq("archived", false)
      .or(`ends_at.is.null,ends_at.gte.${todayISO()}`)
      .order("sort_order"),
    supabase.from("rewards").select("*").order("sort_order"),
  ]);

  const s = (rawStats ?? {}) as Partial<PublicStats>;
  const stats = {
    runners: Number(s.runners ?? 0),
    km: Number(s.km ?? 0),
    runsThisWeek: Number(s.runs_this_week ?? 0),
    challenges: Number(s.challenges ?? 0),
  };

  return <LandingClient stats={stats} challenges={challenges ?? []} rewards={rewards ?? []} />;
}
