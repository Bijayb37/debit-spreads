"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { clamp, roundTo } from "@/lib/debit-call-spread";
import { formatInputDisplayValue } from "@/components/lab/format";

export function CompactNumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  allowDecimals = false,
  displayScale,
  displaySuffix,
  min = 0,
  max,
  step = 1,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  allowDecimals?: boolean;
  displayScale?: number;
  displaySuffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [draftValue, setDraftValue] = useState<{
    value: string;
    displayScale: number;
  } | null>(null);
  const safeDisplayScale =
    displayScale && Number.isFinite(displayScale) && displayScale > 0
      ? displayScale
      : 1;
  const displayedValue =
    draftValue?.displayScale === safeDisplayScale
      ? draftValue.value
      : formatInputDisplayValue(value / safeDisplayScale);
  const safeMax =
    max !== undefined && Number.isFinite(max) ? Math.max(min, max) : undefined;
  const displayMin = min / safeDisplayScale;
  const displayMax = safeMax === undefined ? undefined : safeMax / safeDisplayScale;
  const displayStep =
    safeDisplayScale >= 1_000_000 ? 0.01 : safeDisplayScale > 1 ? 1 : step;
  const normalizeValue = (nextValue: number) =>
    allowDecimals ? roundTo(nextValue, 4) : Math.round(nextValue);
  const clampValue = (nextValue: number) =>
    safeMax === undefined
      ? Math.max(min, nextValue)
      : clamp(nextValue, min, safeMax);

  const commitDraftValue = () => {
    const parsedValue = Number(displayedValue);
    const parsedActualValue = parsedValue * safeDisplayScale;
    const nextValue =
      displayedValue.trim() && Number.isFinite(parsedValue)
        ? clampValue(normalizeValue(parsedActualValue))
        : clampValue(Math.max(1, min));

    setDraftValue(null);
    onChange(nextValue);
  };

  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-0.5 flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 shadow-sm">
        {prefix ? <span className="text-sm text-slate-500">{prefix}</span> : null}
        <input
          type="number"
          min={displayMin}
          max={displayMax}
          step={displayStep}
          value={displayedValue}
          onFocus={() => {
            setDraftValue({
              value: formatInputDisplayValue(value / safeDisplayScale),
              displayScale: safeDisplayScale,
            });
          }}
          onBlur={commitDraftValue}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            const parsedValue = Number(nextValue);

            setDraftValue({ value: nextValue, displayScale: safeDisplayScale });

            if (nextValue.trim() && Number.isFinite(parsedValue)) {
              onChange(
                clampValue(normalizeValue(parsedValue * safeDisplayScale)),
              );
            }
          }}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm font-medium text-slate-950 outline-none tabular-nums"
        />
        {suffix ? <span className="text-sm text-slate-500">{suffix}</span> : null}
        {displaySuffix ? (
          <span className="text-sm text-slate-500">{displaySuffix}</span>
        ) : null}
      </div>
    </label>
  );
}
