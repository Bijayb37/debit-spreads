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
        className="flex h-full min-h-10 w-10 list-none items-center justify-center rounded-lg border border-line-strong bg-surface px-0 text-sm font-semibold text-ink-soft shadow-sm hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-[2.875rem] sm:w-auto sm:px-4"
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
      <div className="absolute right-0 z-50 mt-2 max-h-[calc(100dvh-7rem)] w-56 overflow-y-auto rounded-lg border border-line bg-surface p-3 shadow-xl sm:w-64">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-ink-muted">Color scheme</p>
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
                    "flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    isSelected
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-surface text-ink-soft hover:border-accent hover:bg-surface-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-4 shrink-0 rounded-full", option.swatchClassName)}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected ? (
                    <span className="font-mono text-xs text-accent-strong">On</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase text-ink-muted">Money units</p>
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
                    "flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    isSelected
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-surface text-ink-soft hover:border-accent hover:bg-surface-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="font-mono text-xs text-ink-muted">{option.helper}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase text-ink-muted">
            When price changes
          </p>
          <div
            className="mt-2 grid grid-cols-2 rounded-md border border-line bg-surface-sunken p-1"
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
                "min-w-0 rounded px-2 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                updateStrikesWithPrice
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-secondary hover:text-ink",
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
                "min-w-0 rounded px-2 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                !updateStrikesWithPrice
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-secondary hover:text-ink",
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
