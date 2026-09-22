"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useSupabase } from "@/components/providers/supabase-provider";
import { DIVISIONS } from "@/lib/districts";
import { timeAgo } from "@/lib/progress";
import type { Database } from "@/lib/supabase/types";

const RunningZonesMap = dynamic(() => import("@/components/maps/running-zones-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full animate-pulse rounded-2xl border border-line bg-bg-soft sm:h-[520px]" />
  ),
});

type Zone = Database["public"]["Tables"]["running_zones"]["Row"] & {
  profiles: { name: string } | null;
};

export default function MapsPage() {
  const { supabase, user } = useSupabase();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneDesc, setZoneDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    const { data } = await supabase
      .from("running_zones")
      .select("*, profiles(name)")
      .order("created_at", { ascending: false });
    setZones((data as unknown as Zone[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadZones();
  }, [loadZones]);

  const zonesByDistrict = useMemo(() => {
    const map = new Map<string, Zone[]>();
    zones.forEach((z) => {
      const list = map.get(z.district) ?? [];
      list.push(z);
      map.set(z.district, list);
    });
    return map;
  }, [zones]);

  const zoneCounts = useMemo(() => {
    const map = new Map<string, number>();
    zonesByDistrict.forEach((list, district) => map.set(district, list.length));
    return map;
  }, [zonesByDistrict]);

  const filteredDivisions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DIVISIONS;
    return DIVISIONS.map((div) => ({
      ...div,
      districts: div.districts.filter((d) => d.toLowerCase().includes(q)),
    })).filter((div) => div.districts.length > 0);
  }, [query]);

  const selectedZones = selected ? (zonesByDistrict.get(selected) ?? []) : [];

  async function handleAddZone(e: FormEvent) {
    e.preventDefault();
    if (!user || !selected) return;
    setError(null);
    if (!zoneName.trim()) {
      setError("Give the spot a name.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("running_zones").insert({
      district: selected,
      name: zoneName.trim(),
      description: zoneDesc.trim() || null,
      submitted_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message.includes("duplicate") ? "That spot is already listed." : error.message);
      return;
    }
    setZoneName("");
    setZoneDesc("");
    loadZones();
  }

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold">Running zones</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">
          Good places to run, mapped across all 64 districts — crowd-sourced by runners like you.
        </p>
      </div>

      <div className="mb-8">
        <RunningZonesMap zoneCounts={zoneCounts} onSelectDistrict={setSelected} />
        <p className="mt-2.5 text-[12px] font-medium text-ink-soft">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "#2563EB" }} /> Has
          spots
          <span className="ml-4 mr-1.5 inline-block h-2 w-2 rounded-full border border-ink-soft align-middle" /> Not
          mapped yet — tap a district to add one.
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a district…"
        className="mb-8 w-full max-w-sm rounded-full border border-line bg-bg-soft px-4 py-2.5 text-[14px]"
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-bg-soft" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredDivisions.map((div) => (
            <div key={div.name}>
              <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                {div.name} Division
              </h2>
              <div className="flex flex-wrap gap-2">
                {div.districts.map((d) => {
                  const count = zonesByDistrict.get(d)?.length ?? 0;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelected(d)}
                      className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                        count > 0
                          ? "border-red/30 bg-red-soft text-red-deep hover:opacity-80"
                          : "border-line bg-bg-card text-ink-soft hover:bg-bg-soft"
                      }`}
                    >
                      {d}
                      {count > 0 && <span className="ml-1.5 font-extrabold">· {count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredDivisions.length === 0 && (
            <div className="rounded-2xl border border-line bg-bg-card p-10 text-center text-[14px] text-ink-soft">
              No district matches &quot;{query}&quot;.
            </div>
          )}
        </div>
      )}

      {/* ---------- District detail modal ---------- */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-bg-card p-6 sm:rounded-[24px]"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[19px] font-extrabold">{selected}</h2>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ink-soft hover:bg-bg-soft"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {selectedZones.length === 0 ? (
                <div className="rounded-xl bg-bg-soft p-5 text-center text-[13.5px] text-ink-soft">
                  No spots added here yet — be the first to share one.
                </div>
              ) : (
                selectedZones.map((z) => (
                  <div key={z.id} className="rounded-xl border border-line p-4">
                    <div className="font-bold">{z.name}</div>
                    {z.description && (
                      <p className="mt-1 text-[13px] font-medium text-ink-soft">{z.description}</p>
                    )}
                    <div className="mt-2 text-[11.5px] font-semibold text-ink-soft">
                      Added by {z.profiles?.name ?? "a runner"} · {timeAgo(z.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {user ? (
              <form onSubmit={handleAddZone} className="mt-5 border-t border-line pt-5">
                <label className="mb-1.5 block text-[12.5px] font-bold text-ink-soft" htmlFor="zone-name">
                  Add a spot in {selected}
                </label>
                <input
                  id="zone-name"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Central Park loop"
                  className="w-full rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[14.5px]"
                />
                <textarea
                  value={zoneDesc}
                  onChange={(e) => setZoneDesc(e.target.value)}
                  maxLength={200}
                  placeholder="What makes it good for running? (optional)"
                  className="mt-2.5 min-h-[60px] w-full resize-y rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-[14.5px]"
                />
                {error && <div className="mt-2 text-[12.5px] font-semibold text-red-deep">{error}</div>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-3 w-full rounded-full bg-red py-3 text-[13.5px] font-bold text-white transition disabled:opacity-50"
                >
                  {submitting ? "Adding…" : "Add spot"}
                </button>
              </form>
            ) : (
              <div className="mt-5 border-t border-line pt-5 text-center text-[13px] text-ink-soft">
                Sign in to add a spot here.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
