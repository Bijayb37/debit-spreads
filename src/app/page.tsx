import DebitCallSpreadLab from "@/components/debit-call-spread-lab";
import { addDaysToIso, dateToIso } from "@/lib/debit-call-spread";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type WorkflowLayout = "guided" | "tabbed";

const WORKFLOW_LAYOUT_STORAGE_KEY = "callculator.workflowLayout";

function decodeWorkflowLayout(value: string | undefined): WorkflowLayout {
  return value === "g" ? "guided" : "tabbed";
}

export default async function Home() {
  const todayIso = dateToIso(new Date());
  const defaultExpiryIso = addDaysToIso(todayIso, 60);
  const cookieStore = await cookies();
  const initialWorkflowLayout = decodeWorkflowLayout(
    cookieStore.get(WORKFLOW_LAYOUT_STORAGE_KEY)?.value,
  );

  return (
    <DebitCallSpreadLab
      todayIso={todayIso}
      defaultExpiryIso={defaultExpiryIso}
      initialWorkflowLayout={initialWorkflowLayout}
    />
  );
}
