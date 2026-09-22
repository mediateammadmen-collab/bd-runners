"use client";

import { useRef, useState, type ReactNode } from "react";

export function Carousel({ children }: { children: ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function scrollToIndex(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[i] as HTMLElement | undefined;
    if (child) {
      track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: "smooth" });
    }
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const items = Array.from(track.children) as HTMLElement[];
    let closest = 0;
    let closestDist = Infinity;
    items.forEach((el, i) => {
      const dist = Math.abs(el.offsetLeft - track.scrollLeft);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActive(closest);
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
      >
        {children.map((child, i) => (
          <div key={i} className="w-[82%] flex-none snap-start sm:w-[46%] lg:w-[31%]">
            {child}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => scrollToIndex(Math.max(0, active - 1))}
          aria-label="Previous"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition hover:bg-bg-soft hover:text-ink"
        >
          ‹
        </button>
        <div className="flex items-center gap-1.5">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-red" : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollToIndex(Math.min(children.length - 1, active + 1))}
          aria-label="Next"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition hover:bg-bg-soft hover:text-ink"
        >
          ›
        </button>
      </div>
    </div>
  );
}
