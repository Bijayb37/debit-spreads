"use client";

import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { cn } from "@/lib/cn";
import {
  formatBreakEvenAtExpiry,
  getBreakEvenLabel,
  getComparisonCardTone,
  getComparisonSetupLabel,
  moveCardById,
  orderSelectedCardsFirst,
} from "@/components/lab/comparison-helpers";
import { formatCurrency, formatPercent } from "@/components/lab/format";
import type {
  ComparisonCardAction,
  ComparisonCardData,
} from "@/components/lab/types";

export function CompactStrategyList({
  cards,
  editingCardId,
  selectedCardId,
  onAnalyzeCard,
  onEditCard,
  onRemoveCard,
  onReorderCards,
}: {
  cards: ComparisonCardData[];
  editingCardId?: string | null;
  selectedCardId?: string | null;
  onAnalyzeCard?: ComparisonCardAction;
  onEditCard?: ComparisonCardAction;
  onRemoveCard?: (id: string) => void;
  onReorderCards?: (orderedIds: string[]) => void;
}) {
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [hasManualOrder, setHasManualOrder] = useState(false);
  const activeRowDragRef = useRef<{
    cardId: string;
    pointerId: number;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const suppressedSelectClickRef = useRef<string | null>(null);
  const orderedCards = hasManualOrder
    ? cards
    : orderSelectedCardsFirst(cards, selectedCardId);
  const canReorder = Boolean(onReorderCards && orderedCards.length > 1);

  const getRowIdFromTarget = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) {
      return null;
    }

    const row = target.closest("[data-strategy-row-id]");

    return row instanceof HTMLElement ? row.dataset.strategyRowId ?? null : null;
  };

  const suppressNextSelectClick = (cardId: string) => {
    suppressedSelectClickRef.current = cardId;
    window.setTimeout(() => {
      if (suppressedSelectClickRef.current === cardId) {
        suppressedSelectClickRef.current = null;
      }
    }, 0);
  };

  const beginRowDrag = (
    event: PointerEvent<HTMLElement>,
    card: ComparisonCardData,
  ) => {
    if (
      !canReorder ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    activeRowDragRef.current = {
      cardId: card.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const moveRowDrag = (event: PointerEvent<HTMLElement>) => {
    const activeDrag = activeRowDragRef.current;

    if (!activeDrag || activeDrag.pointerId !== event.pointerId || !onReorderCards) {
      return;
    }

    const deltaX = event.clientX - activeDrag.startX;
    const deltaY = event.clientY - activeDrag.startY;

    if (!activeDrag.isDragging && Math.hypot(deltaX, deltaY) < 6) {
      return;
    }

    event.preventDefault();

    if (!activeDrag.isDragging) {
      activeDrag.isDragging = true;
      setDraggingCardId(activeDrag.cardId);
      setHasManualOrder(true);
    }

    const targetCardId = getRowIdFromTarget(
      document.elementFromPoint(event.clientX, event.clientY),
    );

    if (!targetCardId || targetCardId === activeDrag.cardId) {
      return;
    }

    const nextCards = moveCardById(orderedCards, activeDrag.cardId, targetCardId);
    onReorderCards(nextCards.map((orderedCard) => orderedCard.id));
  };

  const endRowDrag = (event: PointerEvent<HTMLElement>) => {
    const activeDrag = activeRowDragRef.current;

    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    if (activeDrag.isDragging) {
      suppressNextSelectClick(activeDrag.cardId);
    }

    activeRowDragRef.current = null;
    setDraggingCardId(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="hidden grid-cols-[minmax(12rem,2fr)_7rem_5rem_5rem_4rem_6rem_9rem] gap-2 border-b border-line bg-surface-muted px-3 py-2 text-micro font-semibold uppercase text-ink-muted md:grid">
        <span>Strategy</span>
        <span className="text-right">P/L</span>
        <span className="text-right">Return</span>
        <span className="text-right">B/E</span>
        <span className="text-right">DTE</span>
        <span className="text-right">Cost / reserve</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-slate-200">
        {orderedCards.map((card) => {
          const isSelected = card.id === selectedCardId;
          const isEditing = card.id === editingCardId;
          const isDragging = card.id === draggingCardId;
          const pnlIsPositive = card.snapshot.pnl >= 0;
          const tone = getComparisonCardTone(card);

          const dragHandle = canReorder ? (
            <button
              type="button"
              aria-label={`Drag ${card.label} to reorder`}
              onPointerDown={(event) => beginRowDrag(event, card)}
              onPointerMove={moveRowDrag}
              onPointerUp={endRowDrag}
              onPointerCancel={endRowDrag}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className="pointer-events-auto relative z-30 inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-line bg-surface text-ink-muted shadow-sm transition-colors hover:border-accent hover:bg-accent-faint hover:text-ink active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-3.5"
                fill="currentColor"
              >
                <circle cx="5" cy="3" r="1.1" />
                <circle cx="11" cy="3" r="1.1" />
                <circle cx="5" cy="8" r="1.1" />
                <circle cx="11" cy="8" r="1.1" />
                <circle cx="5" cy="13" r="1.1" />
                <circle cx="11" cy="13" r="1.1" />
              </svg>
            </button>
          ) : null;

          const rowContent = (
            <>
              <div className="min-w-0 pr-8 md:pr-0">
                <div className="flex min-w-0 items-start gap-1.5">
                  {dragHandle}
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold text-ink">
                        {card.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-micro font-semibold leading-none",
                          tone.badge,
                        )}
                      >
                        {tone.label}
                      </span>
                      {isSelected ? (
                        <span className="rounded-full bg-accent px-1.5 py-0.5 text-micro font-semibold leading-none text-white">
                          Selected
                        </span>
                      ) : null}
                      {isEditing ? (
                        <span className="rounded-full border border-accent-border bg-surface px-1.5 py-0.5 text-micro font-semibold leading-none text-accent-strong">
                          Editing
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-ink-muted tabular-nums">
                      {getComparisonSetupLabel(card)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 md:contents">
                <div className="min-w-0 md:text-right">
                  <p className="text-micro font-semibold uppercase text-ink-muted md:hidden">
                    P/L
                  </p>
                  <p
                    className={cn(
                      "truncate font-mono font-semibold tabular-nums",
                      pnlIsPositive ? "text-gain" : "text-loss",
                    )}
                  >
                    {pnlIsPositive ? "+" : ""}
                    {formatCurrency(card.snapshot.pnl)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-micro font-semibold uppercase text-ink-muted md:hidden">
                    Return
                  </p>
                  <p
                    className={cn(
                      "truncate font-mono font-semibold tabular-nums",
                      pnlIsPositive ? "text-gain" : "text-loss",
                    )}
                  >
                    {formatPercent(card.snapshot.roi)}
                  </p>
                </div>
                <div className="min-w-0 md:text-right">
                  <p className="text-micro font-semibold uppercase text-ink-muted md:hidden">
                    {getBreakEvenLabel(card.snapshot)}
                  </p>
                  <p className="truncate font-mono font-semibold text-ink tabular-nums">
                    {formatBreakEvenAtExpiry(card.snapshot)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-micro font-semibold uppercase text-ink-muted md:hidden">
                    DTE
                  </p>
                  <p className="truncate font-mono font-semibold text-ink tabular-nums">
                    {card.expirationDays}
                  </p>
                </div>
                <div className="min-w-0 col-span-2 md:col-span-1 md:text-right">
                  <p className="text-micro font-semibold uppercase text-ink-muted md:hidden">
                    {card.snapshot.reserveOffset > 0 ? "Capital reserved" : "Cost basis"}
                  </p>
                  <p className="truncate font-mono font-semibold text-ink tabular-nums">
                    {formatCurrency(card.snapshot.totalCost)}
                  </p>
                </div>
              </div>
            </>
          );

          const rowContentClassName = cn(
            "relative z-20 grid min-w-0 gap-1.5 px-2.5 py-2 text-left text-sm pointer-events-none md:gap-2 md:px-3",
            "md:col-span-6 md:grid-cols-[minmax(12rem,2fr)_7rem_5rem_5rem_4rem_6rem] md:items-center",
          );

          return (
            <article
              key={card.id}
              data-strategy-row-id={card.id}
              className={cn(
                "group relative grid min-w-0 bg-surface text-sm transition-[background-color,box-shadow,opacity,transform] md:grid-cols-[minmax(12rem,2fr)_7rem_5rem_5rem_4rem_6rem_9rem] md:items-stretch",
                onAnalyzeCard && !isSelected && "hover:bg-accent-faint focus-within:bg-accent-faint",
                isSelected && "bg-accent-soft",
                isEditing && "bg-accent-faint ring-1 ring-inset ring-accent",
                isDragging && "z-30 scale-[0.995] bg-surface/80 opacity-70 shadow-lg ring-1 ring-inset ring-slate-300",
              )}
            >
              {isSelected ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 z-20 w-1 bg-accent"
                />
              ) : null}

              {onAnalyzeCard ? (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Select ${card.label}`}
                  onClick={(event) => {
                    if (suppressedSelectClickRef.current === card.id) {
                      event.preventDefault();
                      suppressedSelectClickRef.current = null;
                      return;
                    }

                    onAnalyzeCard(card);
                  }}
                  className={cn(
                    "absolute inset-0 z-10 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent",
                    "cursor-pointer",
                  )}
                />
              ) : null}

              <div className={rowContentClassName}>{rowContent}</div>

              <div className="relative z-20 flex min-w-0 flex-nowrap justify-end gap-1.5 px-2.5 pb-2 md:items-center md:px-3 md:py-2">
                {onEditCard ? (
                  <button
                    type="button"
                    data-row-control="true"
                    aria-label={`Edit ${card.label}`}
                    onClick={() => onEditCard(card)}
                    className={cn(
                      "inline-flex h-8 cursor-pointer items-center justify-center rounded-md border px-2.5 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      isEditing
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-line bg-surface text-ink-soft hover:border-accent hover:bg-accent-faint hover:text-ink",
                    )}
                  >
                    {isEditing ? "Editing" : "Edit"}
                  </button>
                ) : null}
                {onRemoveCard ? (
                  <button
                    type="button"
                    data-row-control="true"
                    aria-label={`Remove ${card.label}`}
                    onClick={() => onRemoveCard(card.id)}
                    className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-line bg-surface px-2.5 text-xs font-semibold text-ink-muted shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-loss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
