import type { CSSProperties, KeyboardEvent } from "react";
import { clamp } from "@/lib/debit-call-spread";

export function getRangeTrackStyle(value: number, min: number, max: number): CSSProperties {
  const span = max - min;
  const progress = span > 0 ? clamp(((value - min) / span) * 100, 0, 100) : 0;

  return {
    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${progress}%, #e2e8f0 ${progress}%, #e2e8f0 100%)`,
  };
}

export function getSliderMax(...values: number[]): number {
  return Math.ceil((Math.max(...values, 50) * 1.8) / 5) * 5;
}

export function getScenarioPriceSliderMax(spot: number, currentValue: number): number {
  return Math.ceil(Math.max(spot * 1.5, currentValue, 5) / 5) * 5;
}

export function parseNumberInput(value: string): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? Math.round(nextValue) : 0;
}

export function parseDecimalInput(value: string): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

export function handleNumberKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onChange: (value: number) => void,
) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (event.key === "Enter") {
    event.currentTarget.blur();
    return;
  }

  if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
    event.preventDefault();
    onChange(0);
    return;
  }

  if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
    event.preventDefault();
    onChange(Number(event.key));
  }
}

export function blurFocusedField() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
