export function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-line bg-bg-soft py-4">
      <div className="flex w-max animate-marquee gap-12">
        {loop.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-12 whitespace-nowrap text-[13px] font-bold uppercase tracking-wide text-ink-soft"
          >
            {item}
            <span className="text-red">●</span>
          </span>
        ))}
      </div>
    </div>
  );
}
