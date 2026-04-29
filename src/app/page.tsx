import DebitCallSpreadLab from "@/components/debit-call-spread-lab";
import { addDaysToIso, dateToIso } from "@/lib/debit-call-spread";

export const dynamic = "force-dynamic";

export default async function Home() {
  const todayIso = dateToIso(new Date());
  const defaultExpiryIso = addDaysToIso(todayIso, 60);

  return (
    <DebitCallSpreadLab
      todayIso={todayIso}
      defaultExpiryIso={defaultExpiryIso}
    />
  );
}
