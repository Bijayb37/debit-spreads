"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const box =
  "flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring";

export const fieldLabel = "block text-xs font-medium text-ink-secondary";

// A number input that applies each valid value as it is typed. What was typed stays
// on screen while it still matches the stored value; otherwise the stored value shows.
export function NumberField({
  id,
  label,
  value,
  prefix,
  suffix,
  min,
  max,
  step = "any",
  hideLabel = false,
  className,
  onCommit,
}: {
  id: string;
  label: string;
  // Keeps the label for screen readers when a visible one sits elsewhere.
  hideLabel?: boolean;
  value: number;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  className?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<{ text: string; value: number } | null>(null);
  const shown = draft && draft.value === value ? draft.text : String(value);

  return (
    <label className={cn(fieldLabel, className)}>
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      <span className={cn(box, "mt-1")}>
        {prefix ? <span className="font-mono text-base text-ink-muted">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={shown}
          onChange={(event) => {
            const text = event.target.value;
            const parsed = Number(text);
            if (text.trim() === "" || !Number.isFinite(parsed)) {
              setDraft({ text, value });
              return;
            }
            setDraft({ text, value: parsed });
            onCommit(parsed);
          }}
          onBlur={() => setDraft(null)}
          className="w-full min-w-0 bg-transparent font-mono text-base font-semibold text-ink outline-none"
        />
        {suffix ? <span className="shrink-0 font-mono text-sm text-ink-muted">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function TextField({
  id,
  label,
  value,
  placeholder,
  maxLength = 10,
  uppercase = false,
  className,
  onCommit,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  placeholder?: string;
  maxLength?: number;
  uppercase?: boolean;
  className?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label className={cn(fieldLabel, className)}>
      {label}
      <span className={cn(box, "mt-1")}>
        <input
          // Remount when the value changes elsewhere (undo, the assistant).
          key={value}
          id={id}
          type="text"
          maxLength={maxLength}
          placeholder={placeholder}
          defaultValue={value}
          onBlur={(event) => onCommit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={cn(
            "w-full min-w-0 bg-transparent text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-muted",
            uppercase ? "font-mono uppercase" : "font-sans",
          )}
        />
      </span>
    </label>
  );
}
