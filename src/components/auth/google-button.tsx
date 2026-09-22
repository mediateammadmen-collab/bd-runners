export function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-bg py-3.5 text-[14px] font-bold text-ink transition hover:bg-bg-soft"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.68-3.87 2.68-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.84.87-3.06.87-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.9a9 9 0 0 0 0 8.08l3.05-2.33Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A8.6 8.6 0 0 0 9 0 9 9 0 0 0 .9 4.96l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
        />
      </svg>
      {label}
    </button>
  );
}
