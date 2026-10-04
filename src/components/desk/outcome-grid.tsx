"use client";

import { cn } from "@/lib/cn";
import {
  MAX_SCENARIOS,
  MAX_STRATEGIES,
  formatMoney,
  formatPct,
  formatPrice,
  strategyStrikes,
  type Board,
  type Desk,
  type PathPoint,
  type Scenario,
  type Step,
  type Strategy,
} from "@/lib/scenario-desk";
import { outcomeTint, seriesColor } from "@/components/desk/colors";

const headLabel = "text-caption font-semibold uppercase tracking-wide text-ink-muted";

export function Money({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        strong ? "text-base font-semibold" : "text-sm font-semibold",
        value > 0.5 ? "text-gain" : value < -0.5 ? "text-loss" : "text-ink-secondary",
      )}
    >
      {formatMoney(value)}
    </span>
  );
}

// "day 20", or "expiry · day 60" for an open-ended last step.
export function stepTiming(step: Step, point: PathPoint): string {
  return step.days === null ? `expiry · day ${point.day}` : `day ${point.day}`;
}

export function OutcomeGrid({
  desk,
  board,
  selectedScenarioId,
  hasCustomOdds,
  onSelectScenario,
  onEditScenario,
  onAddScenario,
  onEditStrategy,
  onAddStrategy,
  onOddsChange,
}: {
  desk: Desk;
  board: Board;
  selectedScenarioId: string;
  hasCustomOdds: boolean;
  onSelectScenario: (id: string) => void;
  onEditScenario: (scenario: Scenario) => void;
  onAddScenario: () => void;
  onEditStrategy: (strategy: Strategy) => void;
  onAddStrategy: () => void;
  onOddsChange: (id: string, odds: number) => void;
}) {
  const cellBorder = "border-b border-l border-line";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">
          Profit or loss of each strategy at the end of each scenario for {desk.market.symbol},
          with the return on its budget.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={cn("sticky left-0 z-10 border-b border-line bg-surface px-3 py-2 align-bottom", headLabel)}>
              Strategy
            </th>
            {desk.scenarios.map((scenario, index) => {
              const isSelected = scenario.id === selectedScenarioId;
              return (
                <th
                  key={scenario.id}
                  scope="col"
                  className={cn("min-w-24 p-0 align-bottom font-normal", cellBorder, isSelected ? "bg-accent-soft" : "bg-surface")}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    title="Show this scenario step by step below"
                    onClick={() => onSelectScenario(scenario.id)}
                    className="block w-full px-2.5 pb-1 pt-2 text-right hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                  >
                    <span className="block text-sm font-semibold leading-tight text-ink text-balance">{scenario.name}</span>
                    <span className="mt-0.5 block font-mono text-xs text-ink-soft tabular-nums">
                      {scenario.steps.length > 1
                        ? `${scenario.steps.length} steps, ends ${formatPrice(board.paths[index].at(-1)!.price)}`
                        : `${formatPrice(board.paths[index][0].price)} · ${formatPct(scenario.steps[0].movePct, 1)}`}
                    </span>
                    <span className="block text-caption text-ink-muted">
                      {stepTiming(scenario.steps.at(-1)!, board.paths[index].at(-1)!)}
                      {scenario.steps.at(-1)!.ivPct === null ? "" : ` · IV ${scenario.steps.at(-1)!.ivPct}%`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditScenario(scenario)}
                    className="block w-full px-2.5 pb-1.5 text-right text-caption font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                  >
                    Edit<span className="sr-only"> scenario {scenario.name}</span>
                  </button>
                </th>
              );
            })}
            {["Your odds", "Worst", "Best"].map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn("min-w-20 border-b border-line bg-surface-muted px-2.5 py-2 text-right align-bottom", headLabel, index === 0 ? "border-l-2" : "border-l")}
              >
                {label}
                <span className="block font-normal normal-case tracking-normal">
                  {index === 0 ? "weighted P/L" : "scenario"}
                </span>
              </th>
            ))}
          </tr>
          <tr>
            <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface-muted px-3 py-1.5 text-left text-xs font-medium text-ink-secondary">
              How likely? <span className="font-normal text-ink-muted">Your weights</span>
            </th>
            {desk.scenarios.map((scenario, index) => (
              <td key={scenario.id} className={cn("bg-surface-muted px-2.5 py-1.5 text-right", cellBorder)}>
                <label className="inline-flex items-center justify-end gap-1.5">
                  <span className="sr-only">Odds for {scenario.name}</span>
                  <input
                    id={`odds-${scenario.id}`}
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={scenario.odds}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (event.target.value !== "" && value >= 0 && value <= 100) onOddsChange(scenario.id, value);
                    }}
                    className="w-12 rounded border border-line-strong bg-surface px-1 py-0.5 text-right font-mono text-xs text-ink tabular-nums outline-none focus:border-accent"
                  />
                  <span className="w-9 text-right font-mono text-caption text-ink-muted tabular-nums">
                    {Math.round(board.oddsPct[index])}%
                  </span>
                </label>
              </td>
            ))}
            <td colSpan={3} className="border-b border-l-2 border-line bg-surface-muted px-2.5 py-1.5 text-right text-caption text-ink-muted">
              {hasCustomOdds ? "Using your weights" : "Equal weights so far"}
            </td>
          </tr>
        </thead>
        <tbody>
          {board.rows.map((row) => (
            <tr key={row.strategy.id}>
              <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface p-0 font-normal">
                <button
                  type="button"
                  title="Edit this strategy"
                  onClick={() => onEditStrategy(row.strategy)}
                  className="flex w-44 items-start gap-2 px-3 py-2 text-left hover:bg-accent-faint sm:w-52 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: seriesColor(row.strategy.id) }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{row.strategy.name}</span>
                    <span className="block truncate font-mono text-xs text-ink-secondary tabular-nums">
                      {strategyStrikes(row.strategy)} · {row.strategy.expirationDays}d
                    </span>
                    {row.problem ? (
                      <span className="block text-caption font-medium text-loss">{row.problem}</span>
                    ) : (
                      <span className="block truncate text-caption text-ink-muted">
                        {row.contracts} contract{row.contracts === 1 ? "" : "s"} · {formatMoney(row.cost, false)} used
                      </span>
                    )}
                  </span>
                </button>
              </th>
              {row.cells.map((cell, index) => {
                const scenario = desk.scenarios[index];
                const isBest = board.bestInScenario[index] === row.strategy.id;
                return (
                  <td
                    key={scenario.id}
                    className={cn("px-2 py-2 text-right align-middle", cellBorder, scenario.id === selectedScenarioId && "outline outline-2 -outline-offset-2 outline-accent/40")}
                    style={{ backgroundColor: row.problem ? undefined : outcomeTint(cell.returnPct) }}
                  >
                    {row.problem ? (
                      <span className="text-xs text-ink-muted">—</span>
                    ) : (
                      <>
                        <span className="block">
                          <Money value={cell.pnl} strong />
                        </span>
                        <span className="block font-mono text-caption text-ink-soft tabular-nums">
                          {cell.expiredDay !== null ? <span className="mr-1 font-sans text-ink-muted">exp. d{cell.expiredDay}</span> : null}
                          {formatPct(cell.returnPct)}
                          {isBest ? (
                            <span title="Highest profit or loss in this scenario" className="ml-1 text-ink">
                              ★<span className="sr-only"> best in this scenario</span>
                            </span>
                          ) : null}
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
              {[row.expected, row.worst, row.best].map((value, index) => (
                <td
                  key={index}
                  className={cn("border-b border-line bg-surface-muted px-2 py-2 text-right align-middle", index === 0 ? "border-l-2" : "border-l")}
                >
                  {row.problem ? <span className="text-xs text-ink-muted">—</span> : <Money value={value} strong={index === 0} />}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" colSpan={desk.scenarios.length + 4} className="sticky left-0 bg-surface px-3 py-2 text-left font-normal">
              <button
                type="button"
                disabled={desk.strategies.length >= MAX_STRATEGIES}
                onClick={onAddStrategy}
                className="rounded-md border border-dashed border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
              >
                + Add strategy
              </button>
              <button
                type="button"
                disabled={desk.scenarios.length >= MAX_SCENARIOS}
                onClick={onAddScenario}
                className="ml-2 rounded-md border border-dashed border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
              >
                + Add scenario
              </button>
              {desk.strategies.length === 0 ? (
                <span className="ml-3 text-sm text-ink-secondary">
                  Add two or more strategies, or ask the assistant to build some, to compare them here.
                </span>
              ) : null}
            </th>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
