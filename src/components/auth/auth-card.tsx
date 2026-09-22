import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-soft px-5 py-12">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-[15px] font-extrabold">
          <span className="h-[9px] w-[9px] rounded-full bg-red" />
          Bd Runner
        </Link>
        <div className="rounded-[20px] border border-line bg-bg-card p-7">
          <h1 className="text-[21px] font-extrabold">{title}</h1>
          <p className="mt-1.5 text-[14px] font-medium text-ink-soft">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
