"use client";

import { CONTRACT_MULTIPLIER } from "@/lib/debit-call-spread";
import type { ScenarioSnapshot } from "@/lib/debit-call-spread";
import { formatCurrencyWithCents } from "@/components/lab/format";

export function RatioCreditSummary({ snapshot }: { snapshot: ScenarioSnapshot }) {
  if (snapshot.reserveOffset <= 0) return null;
  const credit = Math.max(-snapshot.entryPremium, 0) * CONTRACT_MULTIPLIER;
  return (
    <p className="mt-2 text-sm text-ink-secondary">
      Credit / spread: <strong>{formatCurrencyWithCents(credit)}</strong>
      {" · "}Total credit: <strong>{formatCurrencyWithCents(credit * snapshot.contracts)}</strong>
      {" · "}Reserve / spread: <strong>{formatCurrencyWithCents(snapshot.unitCost * CONTRACT_MULTIPLIER)}</strong>.
      {" "}{snapshot.strategy === "call-ratio-spread"
        ? "Sizing uses uncovered-call notional plus spread width, less credit. This is not broker margin; losses are uncapped."
        : "Sizing uses maximum loss as the reserve."}
      {" "}Return is measured against the reserve; position value includes it.
      {snapshot.contracts === 0 ? " Capital is below the reserve for one spread. Increase capital or enable fractional sizing." : ""}
    </p>
  );
}
