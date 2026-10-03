"use client";

import { cn } from "@/lib/cn";
import {
  COLOR_SCHEME_OPTIONS,
  MONEY_DISPLAY_UNIT_OPTIONS,
} from "@/components/lab/constants";
import type { ColorScheme, MoneyDisplayUnit } from "@/components/lab/types";

export function SettingsWidget({
  colorScheme,
  moneyDisplayUnit,
  updateStrikesWithPrice,
  onColorSchemeChange,
  onMoneyDisplayUnitChange,
  onUpdateStrikesWithPriceChange,
}: {
  colorScheme: ColorScheme;
  moneyDisplayUnit: MoneyDisplayUnit;
  updateStrikesWithPrice: boolean;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onMoneyDisplayUnitChange: (unit: MoneyDisplayUnit) => void;
  onUpdateStrikesWithPriceChange: (enabled: boolean) => void;
}) {
  return (
    <details className="relative z-50 h-full">
      <summary
        aria-label="Settings"
        className="flex h-full min-h-10 w-10 list-none items-center justify-center rounded-lg border border-slate-300 bg-white px-0 text-sm font-semibold text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:min-h-[2.875rem] sm:w-auto sm:px-4"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 sm:hidden"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h12" />
          <path d="M4 14h12" />
          <path d="M7 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
          <path d="M10 14a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
        </svg>
        <span className="hidden sm:inline">Settings</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 max-h-[calc(100dvh-7rem)] w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl sm:w-64">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">Color scheme</p>
          <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label="Color scheme">
            {COLOR_SCHEME_OPTIONS.map((option) => {
              const isSelected = colorScheme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={(event) => {
                    onColorSchemeChange(option.value);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-slate-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[var(--accent)] hover:bg-slate-50",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-4 shrink-0 rounded-full", option.swatchClassName)}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected ? (
                    <span className="font-mono text-xs text-[var(--accent-strong)]">On</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Money units</p>
          <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label="Money units">
            {MONEY_DISPLAY_UNIT_OPTIONS.map((option) => {
              const isSelected = moneyDisplayUnit === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onMoneyDisplayUnitChange(option.value)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-slate-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[var(--accent)] hover:bg-slate-50",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="font-mono text-xs text-slate-500">{option.helper}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">
            When price changes
          </p>
          <div
            className="mt-2 grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-1"
            role="radiogroup"
            aria-label="Strike behavior"
          >
            <button
              type="button"
              role="radio"
              aria-checked={updateStrikesWithPrice}
              onPointerDown={() => onUpdateStrikesWithPriceChange(true)}
              onMouseDown={() => onUpdateStrikesWithPriceChange(true)}
              onClick={() => onUpdateStrikesWithPriceChange(true)}
              className={cn(
                "min-w-0 rounded px-2 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                updateStrikesWithPrice
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950",
              )}
            >
              Update strikes
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!updateStrikesWithPrice}
              onPointerDown={() => onUpdateStrikesWithPriceChange(false)}
              onMouseDown={() => onUpdateStrikesWithPriceChange(false)}
              onClick={() => onUpdateStrikesWithPriceChange(false)}
              className={cn(
                "min-w-0 rounded px-2 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                !updateStrikesWithPrice
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950",
              )}
            >
              Keep strikes
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
