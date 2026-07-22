import type { SummaryTableConfig } from "@/components/office-summary/types";

export interface SubPreparer {
  id: string;
  ptin: string;
  contractor: string;
  tax_office: string;
  main_office: string;
  roles: string;
  preparer_client_percent: number;
  office_flat_rate: number;
  availed_payroll: number;
  active: boolean;
}

export interface SubLayoutProps {
  subName: string;
  slug: string;
  officeScope: string;
  offices: string[];
  summaryTables: SummaryTableConfig[];
  setSummaryTables: (updater: (prev: SummaryTableConfig[]) => SummaryTableConfig[]) => void;
  preparers: SubPreparer[];
  isSubUser: boolean;
  loading: boolean;
  hiddenKeys: string[];
  isAdmin: boolean;
  onToggleHidden: (key: string) => void;
  /**
   * Keys hidden specifically for the sub-user (office) view.
   * Admins see these as a second "Hidden (Offices)" bar so they can unhide.
   */
  officesHiddenKeys?: string[];
  /**
   * Scoped hide toggle: 'admin' hides only in admin's view of this sub-account,
   * 'offices' hides for the sub-user.
   */
  onToggleHiddenScoped?: (key: string, scope: "admin" | "offices") => void;
}

export const BUILTIN_KEYS = {
  preparersShare: "__preparers_share",
  sourceRows: "__source_rows",
  referralPayouts: "__referral_payouts",
} as const;

// Per-fee keys live as `__bf:<Fee Type>`, e.g. `__bf:Service Bureau Fee`
export const BF_PREFIX = "__bf:";
export const bfKey = (feeType: string) => `${BF_PREFIX}${feeType}`;
export const isBfKey = (k: string) => k.startsWith(BF_PREFIX);
export const bfFeeFromKey = (k: string) => k.slice(BF_PREFIX.length);

export const BUILTIN_LABELS: Record<string, string> = {
  [BUILTIN_KEYS.preparersShare]: "Preparers Share",
  [BUILTIN_KEYS.sourceRows]: "Source Rows",
  [BUILTIN_KEYS.referralPayouts]: "Referral Payouts",
};

export function labelForKey(
  key: string,
  summaryTables: { id: string; title: string }[],
): string {
  if (BUILTIN_LABELS[key]) return BUILTIN_LABELS[key];
  if (isBfKey(key)) return bfFeeFromKey(key);
  return summaryTables.find((t) => t.id === key)?.title || "Removed table";
}