"use client";

import { motion, type MotionValue } from "framer-motion";

// Colors are hardcoded (not theme tokens): this sits over a fixed dark photo
// overlay in the hero, independent of the site's light/dark mode.
const ROUTES = [
  { d: "M -50 620 C 150 560, 250 680, 420 600 S 700 460, 900 520 S 1150 460, 1300 380", color: "var(--red)", width: 3, opacity: 0.8 },
  { d: "M -80 340 C 120 300, 260 420, 460 360 S 760 220, 980 300 S 1200 260, 1320 180", color: "#ffffff", width: 2, opacity: 0.45 },
  { d: "M -60 500 C 200 440, 320 560, 540 480 S 820 340, 1060 420", color: "#ffffff", width: 2, opacity: 0.3 },
];

const WAYPOINTS = [
  { cx: 420, cy: 600 },
  { cx: 460, cy: 360 },
  { cx: 540, cy: 480 },
];

export function RouteArt({ parallax }: { parallax: MotionValue<number> }) {
  return (
    <motion.svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      style={{ y: parallax }}
      aria-hidden="true"
    >
      {ROUTES.map((route, i) => (
        <motion.path
          key={route.d}
          d={route.d}
          fill="none"
          stroke={route.color}
          strokeWidth={route.width}
          strokeLinecap="round"
          strokeOpacity={route.opacity}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.8, delay: 0.2 + i * 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}

      {WAYPOINTS.map((w, i) => (
        <motion.circle
          key={`${w.cx}-${w.cy}`}
          cx={w.cx}
          cy={w.cy}
          r="4"
          fill="#ffffff"
          stroke="var(--red)"
          strokeWidth="2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.7 }}
          transition={{ duration: 0.4, delay: 1.4 + i * 0.15 }}
        />
      ))}

      <motion.circle
        cx="900"
        cy="520"
        r="6"
        fill="#ffffff"
        stroke="var(--red)"
        strokeWidth="3"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.9 }}
      />
      <motion.circle
        cx="900"
        cy="520"
        r="6"
        fill="none"
        stroke="var(--red)"
        strokeWidth="1.5"
        initial={{ scale: 1, opacity: 0.6 }}
        animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
        transition={{ duration: 2, delay: 2.1, repeat: Infinity, ease: "easeOut" }}
      />
    </motion.svg>
  );
}
