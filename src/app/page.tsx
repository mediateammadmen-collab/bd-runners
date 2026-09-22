import { createClient } from "@/lib/supabase/server";
import { LandingClient } from "@/components/landing/landing-client";
import { weekAgoTimestamp } from "@/lib/progress";

export default async function HomePage() {
  const supabase = await createClient();

  const [{ count: runnerCount }, { data: runsAgg }, { data: challenges }, { data: rewards }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("runs").select("distance_km, created_at"),
      supabase.from("challenges").select("*").order("sort_order"),
      supabase.from("rewards").select("*").order("sort_order"),
    ]);

  const totalKm = (runsAgg ?? []).reduce((sum, r) => sum + Number(r.distance_km), 0);
  const weekAgo = weekAgoTimestamp();
  const runsThisWeek = (runsAgg ?? []).filter(
    (r) => new Date(r.created_at).getTime() >= weekAgo,
  ).length;

  const stats = {
    runners: runnerCount ?? 0,
    km: Math.round(totalKm),
    runsThisWeek,
    challenges: challenges?.length ?? 0,
  };

  return <LandingClient stats={stats} challenges={challenges ?? []} rewards={rewards ?? []} />;
}
