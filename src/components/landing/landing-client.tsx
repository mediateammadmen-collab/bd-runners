"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import { Reveal } from "@/components/landing/reveal";
import { AnimatedNumber } from "@/components/landing/animated-number";
import { Marquee } from "@/components/landing/marquee";
import { Carousel } from "@/components/landing/carousel";
import { RouteArt } from "@/components/landing/route-art";
import type { Challenge } from "@/lib/progress";
import type { Database } from "@/lib/supabase/types";

type Reward = Database["public"]["Tables"]["rewards"]["Row"];

interface Stats {
  runners: number;
  km: number;
  runsThisWeek: number;
  challenges: number;
}

const CITIES = [
  "Dhaka",
  "Chattogram",
  "Sylhet",
  "Rajshahi",
  "Khulna",
  "Comilla",
  "Barishal",
  "Rangpur",
  "Mymensingh",
  "Narayanganj",
];

const STEPS = [
  {
    n: "01",
    icon: "🎯",
    image: "/images/step-1.jpg",
    title: "Join a challenge",
    desc: "Pick from distance goals, day-streaks, or single-run milestones — whatever fits where you are right now. New challenges drop every month.",
  },
  {
    n: "02",
    icon: "📍",
    image: "/images/step-2.jpg",
    title: "Log every run",
    desc: "Strava, Garmin, Coros, Apple Health, or nothing at all — enter your distance however you tracked it. No app lock-in, ever.",
  },
  {
    n: "03",
    icon: "🏆",
    image: "/images/step-3.jpg",
    title: "Earn real rewards",
    desc: "Points convert into cashback, ice cream, and flight tickets. Cross the line first on any challenge and take home a bonus.",
  },
];

const container = "mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-14";

export function LandingClient({
  stats,
  challenges,
  rewards,
}: {
  stats: Stats;
  challenges: Challenge[];
  rewards: Reward[];
}) {
  const { user, loading } = useSupabase();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const artParallax = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const titleScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  const primaryHref = loading ? "#" : user ? "/challenges" : "/auth/signup";
  const primaryLabel = user ? "Go to Dashboard" : "Join a Challenge";

  return (
    <div className="overflow-x-clip bg-bg text-ink">
      {/* ---------- Announcement bar ---------- */}
      <Link
        href={primaryHref}
        className="block bg-band px-4 py-2.5 text-center text-[12.5px] font-semibold text-white transition hover:opacity-90"
      >
        🏆 New: Road to Dhaka 25K just launched — 500 pts up for grabs →
      </Link>

      {/* ---------- Nav ---------- */}
      <div className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className={`${container} flex items-center justify-between gap-5 py-4`}>
          <div className="flex items-center gap-2 text-[15px] font-extrabold">
            <span className="h-[9px] w-[9px] rounded-full bg-red" />
            Bd Runner
          </div>
          <div className="flex items-center gap-3">
            {!loading && !user && (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-ink-soft transition hover:text-ink"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-full bg-red px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90"
                >
                  Get Started
                </Link>
              </>
            )}
            {!loading && user && (
              <Link
                href="/challenges"
                className="rounded-full bg-red px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Hero (full-bleed photo) ---------- */}
      <div ref={heroRef} className="relative overflow-hidden bg-band">
        <Image
          src="/images/hero.jpg"
          alt="Runners jogging together at sunrise on a Dhaka street"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        <RouteArt parallax={artParallax} />

        <div className={`${container} relative z-10 py-24 text-center text-white sm:py-32`}>
          <motion.div style={{ y: titleY, opacity: titleOpacity, scale: titleScale }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[12px] font-bold backdrop-blur-sm"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-red" />
              Bangladesh&apos;s Running Community
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-[16ch] text-[clamp(42px,7.5vw,80px)] font-extrabold leading-[0.98] tracking-tight [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]"
            >
              Run. Earn.
              <br />
              Repeat.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mx-auto mt-6 max-w-[46ch] text-[17px] font-medium text-white/85"
            >
              Join nationwide challenges, log every kilometre from any tracker, and turn points into
              cashback, ice cream, and flight tickets. Fastest finisher on every challenge takes a bonus.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-9 flex flex-wrap justify-center gap-3"
            >
              <Link
                href={primaryHref}
                className="rounded-full border-[1.5px] border-transparent bg-red px-8 py-4 text-[14.5px] font-bold text-white shadow-[0_8px_24px_-8px_var(--red)] transition hover:opacity-90"
              >
                {primaryLabel}
              </Link>
              <a
                href="#rewards"
                className="rounded-full border-[1.5px] border-white/30 bg-white/10 px-8 py-4 text-[14.5px] font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                See Rewards
              </a>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: [0, 8, 0] }}
            transition={{ opacity: { duration: 0.6, delay: 0.6 }, y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } }}
            className="mt-16 flex justify-center text-white/70"
          >
            <svg width="20" height="30" viewBox="0 0 20 30" fill="none">
              <rect x="1" y="1" width="18" height="28" rx="9" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
              <circle cx="10" cy="9" r="2.5" fill="currentColor" opacity="0.9" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* ---------- Marquee ---------- */}
      <Marquee items={CITIES} />

      {/* ---------- Stats band (full-bleed dark) ---------- */}
      <div className="bg-band text-white">
        <div className={`${container} grid grid-cols-2 divide-x divide-white/10 py-10 sm:grid-cols-4`}>
          {[
            { n: stats.runners, l: "Runners" },
            { n: stats.km, l: "Km logged" },
            { n: stats.runsThisWeek, l: "Runs this week" },
            { n: stats.challenges, l: "Challenges" },
          ].map((s) => (
            <div key={s.l} className="px-3 text-center first:pl-0 sm:first:pl-3">
              <div className="text-[32px] font-extrabold sm:text-[38px]">
                <AnimatedNumber value={s.n} />
              </div>
              <div className="mt-1 text-[11.5px] font-semibold uppercase tracking-wide opacity-70">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- How it works: alternating full-bleed sections ---------- */}
      {STEPS.map((step, i) => (
        <div key={step.n} className={i % 2 === 1 ? "bg-bg-soft" : "bg-bg"}>
          <div className={`${container} grid items-center gap-10 py-20 sm:grid-cols-2 sm:py-28`}>
            <Reveal delay={0} className={i % 2 === 1 ? "sm:order-2" : ""}>
              <div className="text-[13px] font-extrabold text-red">{step.n} / 03</div>
              <h2 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight sm:text-[40px]">
                {step.title}
              </h2>
              <p className="mt-4 max-w-[42ch] text-[15.5px] font-medium text-ink-soft">{step.desc}</p>
            </Reveal>
            <motion.div
              initial={{ opacity: 0, x: i % 2 === 1 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={`relative aspect-square overflow-hidden rounded-[28px] border border-line ${
                i % 2 === 1 ? "sm:order-1" : ""
              }`}
            >
              <Image
                src={step.image}
                alt={step.title}
                fill
                className="object-cover"
                sizes="(min-width: 640px) 40vw, 90vw"
              />
              <div className="absolute bottom-4 left-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-[26px] shadow-lg">
                {step.icon}
              </div>
            </motion.div>
          </div>
        </div>
      ))}

      <main>
        {/* ---------- Challenges carousel ---------- */}
        <section className={`${container} py-20`}>
          <Reveal>
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[28px] font-extrabold tracking-tight">Live challenges</h2>
              <span className="text-[13.5px] font-medium text-ink-soft">
                Any tracking app works — Strava, Garmin, Coros, Apple Health, or none at all.
              </span>
            </div>
          </Reveal>
          {challenges.length > 0 && (
            <Carousel>
              {challenges.map((c) => (
                <motion.div
                  key={c.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="h-full rounded-2xl border border-line bg-bg-card p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[17px] font-extrabold tracking-tight">{c.title}</h3>
                      <p className="mt-2 text-[13.5px] font-medium text-ink-soft">{c.description}</p>
                    </div>
                    <div className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-red-soft text-[20px]">
                      {c.emoji}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[12px] font-semibold text-ink-soft">
                    <span>{c.window_label}</span>
                    <span>⭐ {c.points} pts</span>
                  </div>
                </motion.div>
              ))}
            </Carousel>
          )}
        </section>
      </main>

      {/* ---------- Rewards (full-bleed dark) ---------- */}
      <div id="rewards" className="scroll-mt-20 bg-band text-white">
        <div className={`${container} py-20 sm:py-24`}>
          <Reveal className="text-center">
            <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[36px]">
              Points become real rewards
            </h2>
            <p className="mx-auto mt-3 max-w-[52ch] text-[14.5px] font-medium opacity-75">
              Ice cream, bKash/Nagad cashback, and a domestic flight ticket for the biggest stretch goal.
              Finish challenges, redeem what you&apos;ve earned.
            </p>
          </Reveal>

          {rewards.length > 0 && (
            <div className="mt-12">
              <Carousel>
                {rewards.map((r) => (
                  <div key={r.id} className="h-full rounded-2xl border border-white/15 bg-white/5 p-6 text-left backdrop-blur-sm">
                    <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white/10 text-[20px]">
                      {r.emoji}
                    </div>
                    <h3 className="mt-3 text-[16.5px] font-extrabold">{r.name}</h3>
                    <p className="mt-1.5 min-h-9 text-[13px] font-medium opacity-70">{r.description}</p>
                    <div className="mt-4 border-t border-white/15 pt-3 text-[12px] font-bold opacity-80">
                      ⭐ {r.cost} pts
                    </div>
                  </div>
                ))}
              </Carousel>
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href={primaryHref}
              className="inline-block rounded-full bg-red px-8 py-4 text-[14.5px] font-bold text-white transition hover:opacity-90"
            >
              {user ? "View Rewards" : "Start Earning"}
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- Final CTA (full-bleed) ---------- */}
      <div className="bg-red-soft">
        <div className={`${container} flex flex-col items-center gap-6 py-20 text-center sm:flex-row sm:justify-between sm:text-left`}>
          <div>
            <h2 className="text-[26px] font-extrabold tracking-tight text-red-deep">Ready to lace up?</h2>
            <p className="mt-2 text-[14.5px] font-medium text-red-deep opacity-80">
              Free to join. No credit card, no lock-in — just your next run.
            </p>
          </div>
          <Link
            href={primaryHref}
            className="flex-none rounded-full bg-band px-8 py-4 text-[14.5px] font-bold text-white transition hover:opacity-90"
          >
            {primaryLabel}
          </Link>
        </div>
      </div>

      <footer className="border-t border-line py-10">
        <div className={`${container} text-[12px] text-ink-soft`}>
          Bd Runner is an early MVP built for Bangladesh&apos;s running community — points and
          badges today, brand-sponsored rewards and marathon training series coming soon. Runs are
          self-reported; log honestly and run safe, well-lit routes.
        </div>
      </footer>
    </div>
  );
}
