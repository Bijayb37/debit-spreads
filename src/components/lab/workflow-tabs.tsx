"use client";

import { cn } from "@/lib/cn";
import { WORKFLOW_TABS } from "@/components/lab/constants";
import type { WorkflowTab } from "@/components/lab/types";

export function WorkflowTabs({
  activeTab,
  onChange,
}: {
  activeTab: WorkflowTab;
  onChange: (tab: WorkflowTab) => void;
}) {
  return (
    <div
      className="grid min-w-0 grid-cols-5 rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-sm"
      aria-label="Workflow"
    >
      {WORKFLOW_TABS.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={isActive}
            onPointerDown={() => onChange(tab.value)}
            onMouseDown={() => onChange(tab.value)}
            onClick={() => onChange(tab.value)}
            className={cn(
              "group flex min-w-0 items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:gap-2 sm:px-2 sm:text-sm",
              isActive && "bg-white text-slate-950 shadow-sm",
            )}
          >
            <span
              className={cn(
                "hidden size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold tabular-nums sm:flex",
                isActive
                  ? "bg-[var(--accent)] text-white"
                  : "bg-slate-200 text-slate-600 group-hover:bg-slate-300",
              )}
              aria-hidden
            >
              {tab.step}
            </span>
            <span className="truncate sm:hidden">{tab.shortLabel}</span>
            <span className="hidden truncate sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
