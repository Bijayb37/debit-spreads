"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { clamp } from "@/lib/debit-call-spread";

type InfoIconProps = {
  label: string;
};

type TooltipPosition = {
  left: number;
  top: number;
};

export function InfoIcon({ label }: InfoIconProps) {
  const tooltipId = useId();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
    left: 12,
    top: 12,
  });
  const handledPointerActivation = useRef(false);
  const isOpen = isHovered || isFocused || isPinned;
  const updateTooltipPosition = (element: HTMLElement) => {
    const tooltipWidth = 256;
    const viewportPadding = 12;
    const rect = element.getBoundingClientRect();
    const left = clamp(
      rect.right - tooltipWidth,
      viewportPadding,
      Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding),
    );
    const top = clamp(
      rect.bottom + 8,
      viewportPadding,
      Math.max(viewportPadding, window.innerHeight - 112),
    );

    setTooltipPosition({ left, top });
  };
  const togglePinned = (element: HTMLElement) => {
    updateTooltipPosition(element);
    setIsPinned((currentValue) => !currentValue);
  };

  return (
    <span className="inline-flex">
      <button
        type="button"
        aria-label={`More information: ${label}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={(event) => {
          if (handledPointerActivation.current) {
            handledPointerActivation.current = false;
            return;
          }

          event.preventDefault();
          togglePinned(event.currentTarget);
        }}
        onBlur={() => {
          setIsFocused(false);
          setIsPinned(false);
        }}
        onFocus={(event) => {
          updateTooltipPosition(event.currentTarget);
          setIsFocused(true);
        }}
        onMouseDown={(event) => {
          handledPointerActivation.current = true;
          togglePinned(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsPinned(false);
            setIsFocused(false);
            event.currentTarget.blur();
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            handledPointerActivation.current = true;
            togglePinned(event.currentTarget);
          }
        }}
        onPointerEnter={(event) => {
          updateTooltipPosition(event.currentTarget);
          setIsHovered(true);
        }}
        onPointerLeave={() => setIsHovered(false)}
        className="inline-flex size-5 items-center justify-center rounded-full border border-slate-300 bg-white font-[family:var(--font-space-grotesk)] text-xs font-semibold text-slate-500 shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        i
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isOpen}
        style={{
          left: tooltipPosition.left,
          top: tooltipPosition.top,
        }}
        className={cn(
          "pointer-events-none invisible fixed z-50 w-64 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal leading-5 text-slate-700 opacity-0 shadow-lg",
          isOpen && "visible opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}
