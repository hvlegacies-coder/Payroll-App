import { DataTable, Column } from "@/components/payroll/DataTable";
import { StatusBadge } from "@/components/payroll/StatusBadge";
import type { SubPreparer } from "./types";
import { formatMoney } from "@/lib/utils";

const columns: Column<SubPreparer>[] = [
  { key: "ptin", header: "PTIN", mono: true },
  { key: "contractor", header: "Contractor" },
  { key: "tax_office", header: "Office" },
  { key: "roles", header: "Roles" },
  {
    key: "preparer_client_percent",
    header: "Client %",
    mono: true,
    render: (r) => `${r.preparer_client_percent}%`,
  },
  {
    key: "office_flat_rate",
    header: "Flat Rate",
    mono: true,
    render: (r) => formatMoney(Number(r.office_flat_rate || 0), { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  },
  {
    key: "active",
    header: "Status",
    render: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
  },
];

export function SubPreparersList({ preparers, loading }: { preparers: SubPreparer[]; loading: boolean }) {
  return (
    <DataTable
      data={preparers}
      columns={columns}
      emptyMessage={loading ? "Loading…" : "No preparers mapped."}
    />
  );
}