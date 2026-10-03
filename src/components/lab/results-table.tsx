"use client";

import { cn } from "@/lib/cn";
import type { TableColumn } from "@/components/lab/types";

type ResultsTableProps<Row extends { id: string; isHighlighted?: boolean }> = {
  title: string;
  subtitle: string;
  columns: TableColumn<Row>[];
  rows: Row[];
};

export function ResultsTable<Row extends { id: string; isHighlighted?: boolean }>({
  title,
  subtitle,
  columns,
  rows,
}: ResultsTableProps<Row>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-3 py-2.5">
        <h3 className="font-[family:var(--font-space-grotesk)] text-base font-semibold text-slate-950">
          {title}
        </h3>
        <p className="mt-1 text-xs text-slate-500 text-pretty">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-3 py-2 text-left font-medium",
                    column.align === "right" && "text-right",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-slate-100",
                  row.isHighlighted && "bg-[var(--accent-soft)]",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-2 align-top font-mono tabular-nums text-slate-950",
                      column.align === "right" && "text-right",
                      column.muted && "text-slate-600",
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
