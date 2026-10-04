import DebitCallSpreadLab from "@/components/debit-call-spread-lab";
import { addDaysToIso, dateToIso } from "@/lib/debit-call-spread";
import type { Metadata } from "next";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Classic calculator",
  robots: { index: false, follow: true },
};

// The earlier single-strategy calculator, kept reachable from the scenario desk.
export default function ClassicPage() {
  const todayIso = dateToIso(new Date());

  return (
    <DebitCallSpreadLab
      todayIso={todayIso}
      defaultExpiryIso={addDaysToIso(todayIso, 60)}
    />
  );
}
