"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { clamp, roundTo } from "@/lib/debit-call-spread";
import { formatInputDisplayValue } from "@/components/lab/format";
import { InfoIcon } from "@/components/lab/info-icon";
import {
  blurFocusedField,
  getRangeTrackStyle,
  handleNumberKeyDown,
  parseDecimalInput,
  parseNumberInput,
} from "@/components/lab/input-helpers";

type NumberSliderFieldProps = {
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  prefix?: string;
  allowDecimals?: boolean;
  displayScale?: number;
  displaySuffix?: string;
  quickActions?: Array<{
    label: string;
    value: number;
  }>;
  toggleAction?: {
    label: string;
    pressed: boolean;
    onClick: () => void;
  };
  className?: string;
  headerClassName?: string;
  sliderClassName?: string;
};

export function NumberSliderField({
  label,
  help,
  min,
  max,
  step,
  value,
  onChange,
  suffix = "",
  prefix = "",
  allowDecimals = false,
  displayScale,
  displaySuffix = "",
  quickActions = [],
  toggleAction,
  className,
  headerClassName,
  sliderClassName,
}: NumberSliderFieldProps) {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const helpId = `${fieldId}-help`;
  const dragMaxRef = useRef<number | null>(null);
  const [dragMax, setDragMax] = useState<number | null>(null);
  const [draftInputValue, setDraftInputValue] = useState<string | null>(null);
  const safeDisplayScale =
    displayScale && Number.isFinite(displayScale) && displayScale > 0
      ? displayScale
      : 1;
  const sliderMax = dragMax ?? Math.max(max, value);
  const safeValue = clamp(value, min, max);
  const safeSliderValue = clamp(value, min, sliderMax);
  const inputValue =
    Number.isFinite(value) && (value < min || value > max)
      ? value
      : safeValue;
  const displayInputValue =
    draftInputValue ??
    formatInputDisplayValue(inputValue / safeDisplayScale);
  const displayMin = min / safeDisplayScale;
  const displayMax = sliderMax / safeDisplayScale;
  const displaySliderMax = sliderMax / safeDisplayScale;
  const displayStep =
    safeDisplayScale >= 1_000_000 ? 0.01 : safeDisplayScale > 1 ? 1 : step;
  const displaySuffixLabel = `${suffix}${displaySuffix}`;
  const parseInputValue = allowDecimals ? parseDecimalInput : parseNumberInput;
  const normalizeActualValue = (nextValue: number) =>
    allowDecimals ? roundTo(nextValue, 4) : Math.round(nextValue);
  const handleInputChange = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) {
      onChange(0);
      return;
    }

    onChange(Math.max(normalizeActualValue(nextValue * safeDisplayScale), 0));
  };
  const handleInputTextChange = (nextValue: string) => {
    const parsedValue = parseInputValue(nextValue);

    setDraftInputValue(nextValue);

    if (nextValue.trim() && Number.isFinite(parsedValue)) {
      handleInputChange(parsedValue);
    }
  };
  const commitInputText = () => {
    if (draftInputValue === null) {
      return;
    }

    const parsedValue = parseInputValue(draftInputValue);

    if (draftInputValue.trim() && Number.isFinite(parsedValue)) {
      handleInputChange(parsedValue);
    }

    setDraftInputValue(null);
  };
  const handleSliderChange = (nextValue: number) => {
    setDraftInputValue(null);

    if (dragMaxRef.current === null) {
      dragMaxRef.current = sliderMax;
      setDragMax(sliderMax);
    }

    const activeSliderMax = dragMaxRef.current;

    if (!Number.isFinite(nextValue)) {
      onChange(min);
      return;
    }

    onChange(clamp(nextValue, min, activeSliderMax));
  };
  const beginSliderDrag = () => {
    blurFocusedField();

    if (dragMaxRef.current !== null) {
      return;
    }

    dragMaxRef.current = sliderMax;
    setDragMax(sliderMax);
  };
  const endSliderDrag = () => {
    dragMaxRef.current = null;
    setDragMax(null);
  };

  return (
    <div className={cn("min-w-0 rounded-panel bg-surface-muted p-panel", className)}>
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_5.75rem] items-start gap-2",
          headerClassName,
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p id={labelId} className="text-sm font-medium text-slate-900">
              {label}
            </p>
            <InfoIcon label={help} />
          </div>
          <span id={helpId} className="sr-only">
            {help}
          </span>
        </div>
        <div className="w-[5.75rem] min-w-0 shrink-0">
          <div className="flex items-center rounded-md border border-line-strong bg-surface px-2 py-1.5">
            {prefix ? <span className="text-sm text-ink-muted">{prefix}</span> : null}
            <input
              type="number"
              value={displayInputValue}
              min={displayMin}
              max={displayMax}
              step={displayStep}
              aria-labelledby={labelId}
              aria-describedby={helpId}
              onFocus={() => setDraftInputValue(displayInputValue)}
              onBlur={commitInputText}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                  return;
                }

                if (!allowDecimals) {
                  handleNumberKeyDown(event, (nextValue) => {
                    setDraftInputValue(formatInputDisplayValue(nextValue));
                    handleInputChange(nextValue);
                  });
                }
              }}
              onInput={(event) => handleInputTextChange(event.currentTarget.value)}
              onChange={(event) => handleInputTextChange(event.target.value)}
              className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-ink outline-none tabular-nums"
            />
            {displaySuffixLabel ? (
              <span className="text-sm text-ink-muted">{displaySuffixLabel}</span>
            ) : null}
          </div>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={safeSliderValue}
        aria-labelledby={labelId}
        aria-describedby={helpId}
        onBlur={endSliderDrag}
        onChange={(event) => handleSliderChange(Number(event.target.value))}
        onMouseDown={beginSliderDrag}
        onPointerCancel={endSliderDrag}
        onPointerDown={beginSliderDrag}
        onPointerUp={endSliderDrag}
        onTouchCancel={endSliderDrag}
        onTouchEnd={endSliderDrag}
        onTouchStart={beginSliderDrag}
        style={getRangeTrackStyle(safeSliderValue, min, sliderMax)}
        className={cn(
          "mt-2.5 h-2 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent",
          sliderClassName,
        )}
      />
      <div className="mt-1 grid min-h-4 grid-cols-2 gap-2 font-mono text-micro leading-tight text-ink-muted tabular-nums">
        <span className="truncate whitespace-nowrap">
          {prefix}
          {formatInputDisplayValue(displayMin)}
          {displaySuffixLabel}
        </span>
        <span className="truncate whitespace-nowrap text-right">
          {prefix}
          {formatInputDisplayValue(displaySliderMax)}
          {displaySuffixLabel}
        </span>
      </div>
      {quickActions.length > 0 ? (
        <div className="mt-2 grid min-w-0 grid-cols-4 gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onChange(clamp(action.value, 0, max))}
              className="min-w-0 truncate whitespace-nowrap rounded-md border border-line-strong bg-surface px-1 py-1.5 text-micro font-medium text-ink-soft shadow-sm hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {toggleAction ? (
        <button
          type="button"
          aria-pressed={toggleAction.pressed}
          onClick={toggleAction.onClick}
          className={cn(
            "mt-2 w-full rounded-md border px-2 py-1.5 text-xs font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            toggleAction.pressed
              ? "border-accent bg-accent text-white"
              : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent",
          )}
        >
          {toggleAction.label}
        </button>
      ) : null}
    </div>
  );
}
