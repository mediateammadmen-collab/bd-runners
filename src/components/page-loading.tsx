export function PageLoading({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[220px] animate-pulse rounded-2xl border border-line bg-bg-soft" />
      ))}
    </div>
  );
}
