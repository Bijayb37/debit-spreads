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
      className="grid min-w-0 grid-cols-4 rounded-lg border border-line bg-surface-sunken p-1 shadow-sm"
      aria-label="Workflow"
    >
      {WORKFLOW_TABS.map((tab) => {
        // The heat map is a view inside Analyze, not a step of its own.
        const isActive =
          activeTab === tab.value ||
          (tab.value === "analysis" && activeTab === "heatmap");
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={isActive}
            onPointerDown={() => onChange(tab.value)}
            onMouseDown={() => onChange(tab.value)}
            onClick={() => onChange(tab.value)}
            className={cn(
              "group flex min-w-0 items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-semibold text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-2 sm:px-2 sm:text-sm",
              isActive && "bg-surface text-ink shadow-sm",
            )}
          >
            {tab.step ? (
            <span
              className={cn(
                "hidden size-5 shrink-0 items-center justify-center rounded-full font-mono text-micro font-semibold tabular-nums sm:flex",
                isActive
                  ? "bg-accent text-white"
                  : "bg-slate-200 text-ink-secondary group-hover:bg-slate-300",
              )}
              aria-hidden
            >
              {tab.step}
            </span>
            ) : null}
            <span className="truncate sm:hidden">{tab.shortLabel}</span>
            <span className="hidden truncate sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
