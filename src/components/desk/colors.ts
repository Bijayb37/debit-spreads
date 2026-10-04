// Categorical series colours in a fixed order. A strategy keeps its colour for as
// long as it exists, because the slot comes from its id, not its position.
const SERIES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

export function seriesColor(strategyId: string): string {
  const slot = Number(/(\d+)$/.exec(strategyId)?.[1] ?? 1) - 1;
  return SERIES[((slot % SERIES.length) + SERIES.length) % SERIES.length];
}

// Tint strength follows the size of the return, capped at the whole budget.
export function outcomeTint(returnPct: number): string | undefined {
  if (Math.abs(returnPct) < 0.05) return undefined;
  // Rounded so the server and the browser render the same string.
  const alpha = Math.round((0.07 + 0.3 * Math.min(1, Math.abs(returnPct) / 100)) * 100) / 100;
  return returnPct > 0 ? `rgb(4 120 87 / ${alpha})` : `rgb(190 18 60 / ${alpha})`;
}
