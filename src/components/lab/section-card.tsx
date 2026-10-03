"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  eyebrowClassName?: string;
  hideHeader?: boolean;
  action?: ReactNode;
};

export function SectionCard({
  title,
  eyebrow,
  children,
  className,
  eyebrowClassName,
  hideHeader = false,
  action,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm",
        className,
      )}
    >
      {!hideHeader ? (
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <p
                className={cn(
                  "text-sm font-medium text-[var(--accent)]",
                  eyebrowClassName,
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            <h2 className="font-[family:var(--font-space-grotesk)] text-lg font-semibold text-balance text-slate-950">
              {title}
            </h2>
          </div>
          {action ? <div className="min-w-0 shrink-0 basis-full sm:basis-auto">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
