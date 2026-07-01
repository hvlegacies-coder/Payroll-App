import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Calculator, DollarSign, Building2, FileText, Hash, RefreshCw, Percent } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  term: string;
  plain: string;
  type: 'text' | 'number' | 'yes/no' | 'calculated' | 'status' | 'percent';
  desc: string;
  example?: string;
  where?: string;
}

interface Category {
  id: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
  entries: Entry[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const categories: Category[] = [
  {
    id: 'people',
    label: 'People & Identity',
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500',
    entries: [
      {
        term: 'PTIN',
        plain: 'Preparer Tax ID Number',
        type: 'text',
        desc: 'A unique ID number issued by the IRS to every tax preparer. Think of it like a Social Security Number, but for tax professionals. Every row in the payroll report is linked to a preparer using this number.',
        example: 'P01234567',
        where: 'Payroll Report, Master PTIN (Preparers)',
      },
      {
        term: 'EFIN',
        plain: 'Electronic Filing ID Number',
        type: 'text',
        desc: 'A 6-digit number the IRS gives to each tax office so they can file returns electronically. It identifies which office location a return was filed from. One office can have a primary EFIN and a secondary EFIN.',
        example: '387641',
        where: 'Payroll Report, Master PTIN (Office)',
      },
      {
        term: 'Secondary EFIN (EFIN2)',
        plain: 'Backup Filing ID',
        type: 'text',
        desc: 'Some preparers file under a second EFIN (a different office location). If the system can\'t match the primary EFIN, it tries the secondary one. Used when a preparer works across two office locations.',
        example: '390000',
        where: 'Master PTIN (Preparers)',
      },
      {
        term: 'Contractor',
        plain: 'Tax Preparer Name',
        type: 'text',
        desc: 'The full legal name of the tax preparer / independent contractor. This is the name that appears on all reports, earnings summaries, and email notifications.',
        example: 'Jane Smith',
        where: 'Master PTIN (Preparers), Payroll Reports',
      },
      {
        term: 'Tax Office',
        plain: 'Which Office the Preparer Belongs To',
        type: 'text',
        desc: 'The name of the office this preparer currently works under. This determines which office report their earnings appear in. If a preparer moves offices, updating this field automatically reroutes all their rows.',
        example: 'Higher View, King J, D&D, PowerPlay',
        where: 'Master PTIN (Preparers)',
      },
      {
        term: 'Landing Tab',
        plain: 'Which Report Tab They Appear In',
        type: 'text',
        desc: 'When the system distributes payroll rows to office reports, this field tells it exactly which tab to place the preparer\'s rows in. Usually matches the Tax Office but can differ for special routing.',
        example: 'Higher View',
        where: 'Master PTIN (Preparers)',
      },
      {
        term: 'Client Belongs To',
        plain: 'Which Preparer "Owns" This Client',
        type: 'text',
        desc: 'Indicates which preparer has the client relationship for a specific taxpayer. Used by Higher View to decide which pay formula to apply — a preparer earns more when the client belongs to them versus when they\'re serving someone else\'s client.',
        example: 'Jane Smith',
        where: 'Client Data Report, Payroll Processing',
      },
      {
        term: 'SSN Last 4',
        plain: 'Last 4 Digits of Taxpayer Social Security Number',
        type: 'text',
        desc: 'Used as part of the matching key to identify taxpayers without storing the full SSN. Combined with the first and last name for fuzzy matching across reports.',
        example: '4891',
        where: 'Advance Report, Client Data Report',
      },
    ],
  },
  {
    id: 'fees',
    label: 'Fee Types (Plain English)',
    icon: DollarSign,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500',
    entries: [
      {
        term: 'Tax Prep Fee (ERO Fee)',
        plain: 'The Main Fee Charged for Preparing the Tax Return',
        type: 'number',
        desc: 'The primary fee the tax preparer charges the client for preparing their tax return — data entry, calculations, and making sure everything is correct. This is usually the biggest fee and varies based on how complex the return is.',
        example: '$350 for a simple return, $600 for a return with multiple W-2s and deductions',
        where: 'Payroll Report → Received Tax Prep Fees column',
      },
      {
        term: 'Service Bureau Fee',
        plain: 'Platform / Franchise Fee',
        type: 'number',
        desc: 'A fee paid to the main office (Higher View) for providing the tax software, training, compliance support, and backend processing systems that sub-offices use. Think of it like a franchise fee — sub-offices pay for access to the platform.',
        example: '$50 per office per week',
        where: 'Backend Money Report, Backend Fee Configuration',
      },
      {
        term: 'Transmitter Fee',
        plain: 'Fee for Sending the Return to the IRS',
        type: 'number',
        desc: 'Charged for the act of electronically transmitting the completed return to the IRS or bank product center. The office keeps everything above $10 per row — so a $15 transmitter fee means the office keeps $5.',
        example: '$12 fee → office keeps $2. $9 fee → office keeps $0.',
        where: 'Payroll Report, Office Summary → Transmitter Fee column',
      },
      {
        term: 'E-File Fee',
        plain: 'Electronic Filing Fee',
        type: 'number',
        desc: 'Fee charged for filing the return electronically instead of on paper. Covers submission, pre-validation checks, and faster IRS confirmation. Sometimes bundled together with the transmitter fee.',
        example: '$20–$40 per return',
        where: 'Backend Fee Configuration',
      },
      {
        term: 'ERO3 Fee',
        plain: 'Additional ERO Charge (Third-Party)',
        type: 'number',
        desc: 'A supplemental fee charged by certain ERO setups for additional services beyond standard preparation. Configured per office in the Backend Fee section.',
        where: 'Backend Fee Configuration',
      },
      {
        term: 'Fee Intercept',
        plain: 'Fees Deducted Directly from the Client\'s Refund',
        type: 'number',
        desc: 'Instead of the client paying fees upfront, the bank product automatically withholds ("intercepts") the tax prep fees from the client\'s refund before sending the rest to the client. The office receives the intercepted amount separately.',
        example: 'Client refund = $1,200. Fees = $350. Client receives $850. Office receives $350 via intercept.',
        where: 'Fee Intercept Report, Office Summary',
      },
      {
        term: 'Advance Fee',
        plain: 'Cost of Getting a Tax Refund Loan',
        type: 'number',
        desc: 'A fixed $100 fee deducted from the preparer\'s received fees when a client takes out a tax advance (loan against their expected refund). This is deducted before calculating the preparer\'s pay.',
        example: 'Preparer earned $350. Client had advance → $350 − $100 = $250 (After Advance).',
        where: 'Payroll Report → Advance Requested column',
      },
      {
        term: 'Backend Money',
        plain: 'Add-On Fee Money Coming Back to the Office',
        type: 'number',
        desc: 'Revenue from add-on fees (service bureau, software, ERO3, etc.) that flows back to each office after being collected. Loaded from the Backend Money Report and added to the office\'s Net Pay.',
        example: 'Office earned $2,000 from prep fees (AGI) + $800 backend money = $2,800 Net Pay.',
        where: 'Backend Money Report, Office Summary → Backend Money',
      },
    ],
  },
  {
    id: 'calculations',
    label: 'Calculated Fields',
    icon: Calculator,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500',
    entries: [
      {
        term: 'Received Tax Prep Fees',
        plain: 'What the Client Actually Paid',
        type: 'number',
        desc: 'The total tax preparation fees actually collected from the client for this return. This is the starting number for all pay calculations.',
        example: '$400',
        where: 'Payroll Report (every row)',
      },
      {
        term: 'After Advance',
        plain: 'Received Fees After Subtracting the Advance Fee',
        type: 'calculated',
        desc: 'If the client requested a tax advance (loan), $100 is subtracted here before any pay is calculated. If no advance, this equals the Received Fees.',
        example: 'No advance: $400 → After Advance = $400. With advance: $400 − $100 = $300.',
        where: 'Payroll Processing, Office Summary',
      },
      {
        term: 'Pay',
        plain: 'The Preparer\'s Gross Payment',
        type: 'calculated',
        desc: 'The dollar amount the preparer earns from this client row, calculated by multiplying After Advance by the preparer\'s Share %. This is the base payout before any office-specific adjustments.',
        example: 'After Advance = $300, Share % = 60% → Pay = $180.',
        where: 'Payroll Processing',
      },
      {
        term: 'Preparer Share',
        plain: 'What the Preparer Actually Takes Home',
        type: 'calculated',
        desc: 'The final amount the preparer receives. For most offices this equals Pay. For Higher View and King J, additional formulas apply based on client ownership and office-specific rules. This is the number used in the Preparer Share table.',
        example: 'Higher View: If client belongs to preparer → Share = Received Fees × preparer_client_percent%',
        where: 'Payroll Processing, Preparer Share Table',
      },
      {
        term: 'Share %',
        plain: 'The Preparer\'s Cut Percentage',
        type: 'percent',
        desc: 'The percentage of received fees the preparer keeps. Set per-preparer in the Master PTIN table. A 60% share means for every $100 in received fees, the preparer earns $60.',
        example: '60% → $300 After Advance → $180 Pay',
        where: 'Master PTIN (Preparers)',
      },
      {
        term: 'Shared EFIN %',
        plain: 'Special Rate When Filing Under a Different Office\'s EFIN',
        type: 'percent',
        desc: 'A separate share percentage that applies when a preparer\'s EFIN doesn\'t match the office\'s EFIN. This happens when a preparer uses a different office\'s filing credentials — they earn a different (usually lower) rate.',
        example: 'Normal share: 60%, Shared EFIN share: 40%',
        where: 'Master PTIN (Preparers)',
      },
      {
        term: 'Preparer Client %',
        plain: 'Higher View Rate When the Client Belongs to the Preparer',
        type: 'percent',
        desc: 'Higher View only. When a client relationship belongs to the preparer, this percentage is applied to the received fees. Typically higher than the flat rate because the preparer brought in / owns the client.',
        example: '50% → Received $400 → Share = $200',
        where: 'Master PTIN (Preparers) — Higher View preparers only',
      },
      {
        term: 'Office Flat Rate',
        plain: 'Higher View Rate When the Client Does NOT Belong to the Preparer',
        type: 'number',
        desc: 'Higher View only. When a preparer is serving someone else\'s client, they earn this fixed dollar amount instead of a percentage. Ensures preparers are still paid fairly when helping with clients they don\'t own.',
        example: '$75 flat rate — preparer earns $75 regardless of the client\'s fees',
        where: 'Master PTIN (Preparers) — Higher View preparers only',
      },
      {
        term: 'King J Preparer Share',
        plain: 'King J Office Share Percentage',
        type: 'percent',
        desc: 'King J office only. A fixed percentage of After Advance that the preparer earns. Simpler than Higher View\'s two-path formula — just one percentage applied uniformly.',
        example: '55% → After Advance $250 → Share = $137.50',
        where: 'Master PTIN (Preparers) — King J preparers only',
      },
    ],
  },
  {
    id: 'office-report',
    label: 'Office Report Totals',
    icon: Building2,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500',
    entries: [
      {
        term: 'Total Received Prep Fee',
        plain: 'All Client Fees Collected This Week',
        type: 'calculated',
        desc: 'The grand total of all tax preparation fees received from clients by this office for the current payroll period. Sum of every row\'s Received Tax Prep Fees.',
        example: '50 clients × avg $350 = $17,500',
        where: 'Office Summary',
      },
      {
        term: 'High Prep Fee Total',
        plain: 'Fees Flagged as Unusually High',
        type: 'calculated',
        desc: 'The sum of fees that were flagged as "high prep fee" returns. These are charged to the office as part of Total Fees Due. Flagging high fees ensures proper accounting of premium returns.',
        where: 'Office Summary → Total Fees Due',
      },
      {
        term: 'Preparer Fee Total',
        plain: 'Total Fixed Fees Charged Across All Preparers',
        type: 'calculated',
        desc: 'The sum of the per-preparer fixed fee (default $25 for Higher View) across all preparers at this office this week. Charged once per preparer regardless of how many clients they served.',
        example: '8 preparers × $25 = $200 total preparer fees',
        where: 'Office Summary → Total Fees Due',
      },
      {
        term: 'Transmitter Fee Total',
        plain: 'Total Transmitter Revenue (Amount Above $10 Per Row)',
        type: 'calculated',
        desc: 'Sum of the office\'s share of transmitter fees across all rows. Only the amount above $10 per row counts — rows with $10 or less contribute $0.',
        example: '5 rows: $12, $8, $15, $10, $20 → contributions: $2, $0, $5, $0, $10 = $17 total',
        where: 'Office Summary → Total Fees Due',
      },
      {
        term: 'Total Fees Due',
        plain: 'Everything the Office Owes Before AGI',
        type: 'calculated',
        desc: 'The total of all fees deducted from the office\'s revenue: High Prep Fees + Preparer Fees + Fee Intercept + Transmitter Fees. This is subtracted from Total Received to get AGI.',
        example: 'High Prep $500 + Preparer Fee $200 + Intercept $300 + Transmitter $17 = $1,017 Total Fees Due',
        where: 'Office Summary',
      },
      {
        term: 'AGI',
        plain: 'Adjusted Gross Income — What\'s Left After Fees',
        type: 'calculated',
        desc: 'The office\'s net revenue after all fees are deducted. AGI = Total Received Prep Fees − Total Fees Due. This is the office\'s core earnings before adding backend money.',
        example: '$17,500 received − $1,017 fees = $16,483 AGI',
        where: 'Office Summary',
      },
      {
        term: 'Net Pay',
        plain: 'Final Amount the Office Actually Receives',
        type: 'calculated',
        desc: 'The office\'s total take-home for the week. Net Pay = AGI + Backend Money. This is the bottom-line number — what actually gets paid out.',
        example: '$16,483 AGI + $800 backend = $17,283 Net Pay',
        where: 'Office Summary',
      },
    ],
  },
  {
    id: 'office-config',
    label: 'Office Configuration',
    icon: Building2,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500',
    entries: [
      {
        term: 'Process Advance',
        plain: 'Does This Office Handle Tax Advance Loans?',
        type: 'yes/no',
        desc: 'When turned ON, the system applies the $100 advance fee deduction for clients at this office who requested a tax loan. When OFF, advances are ignored for this office.',
        where: 'Master PTIN (Office) — Office settings',
      },
      {
        term: 'Process Front End',
        plain: 'Does This Office Collect Upfront Fees?',
        type: 'yes/no',
        desc: 'Controls whether this office\'s rows go through front-end fee processing (fees collected directly from the client at time of filing, not via intercept).',
        where: 'Master PTIN (Office) — Office settings',
      },
      {
        term: 'Process Backend',
        plain: 'Does This Office Receive Backend Add-On Fees?',
        type: 'yes/no',
        desc: 'When ON, backend money (service bureau fees, software fees, etc.) flows through to this office from the Backend Money Report.',
        where: 'Master PTIN (Office) — Office settings',
      },
      {
        term: 'Process Preparers Share',
        plain: 'Does This Office Track Individual Preparer Earnings?',
        type: 'yes/no',
        desc: 'When ON, the system generates a Preparer Share breakdown for this office — showing each preparer\'s individual earnings for the week.',
        where: 'Master PTIN (Office) — Office settings',
      },
      {
        term: 'Parent Office',
        plain: 'Which Bigger Office This One Reports To',
        type: 'text',
        desc: 'If this is a sub-office, the parent office field identifies who it rolls up to. Used for office hierarchy and consolidated reporting.',
        example: 'D&D is a sub-office → Parent Office = Higher View',
        where: 'Master PTIN (Office), Office Hierarchy',
      },
      {
        term: 'Clients Belongs Data',
        plain: 'Does This Office Use the Client Ownership Feature?',
        type: 'yes/no',
        desc: 'When ON, the system uses the Client Belongs To field when calculating Higher View preparer shares. When OFF, client ownership is ignored in calculations.',
        where: 'Master PTIN (Office)',
      },
      {
        term: 'Extra EFINs',
        plain: 'Additional Filing IDs to Include in This Office\'s Data',
        type: 'text',
        desc: 'A comma-separated list of additional EFINs whose rows should be counted as part of this office. Useful when an office has multiple filing locations that all roll up to one report.',
        example: '387641, 390000, 395555',
        where: 'Master PTIN (Office)',
      },
      {
        term: 'Default Preparers Share',
        plain: 'Which Pay Formula to Use by Default',
        type: 'text',
        desc: 'Determines which formula is used by default when calculating preparer shares for this office. "Preparer Client %" uses the percentage-based formula; "Office Flat Rate" uses the fixed dollar amount.',
        example: 'Preparer Client % or Office Flat Rate',
        where: 'Master PTIN (Office) — when Process Preparers Share is ON',
      },
    ],
  },
  {
    id: 'status',
    label: 'Row Status Terms',
    icon: RefreshCw,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500',
    entries: [
      {
        term: 'imported',
        plain: 'Just Uploaded — Not Yet Processed',
        type: 'status',
        desc: 'The row was just loaded from the payroll report file. The system knows it exists but hasn\'t matched the PTIN, calculated pay, or done anything with it yet.',
        where: 'Payroll Processing → Status column',
      },
      {
        term: 'mapped',
        plain: 'Preparer Found — Office and Pay Rate Known',
        type: 'status',
        desc: 'The PTIN was successfully matched to a preparer in the lookup table. The system now knows which office this row belongs to, what pay percentage applies, and all other preparer details.',
        where: 'Payroll Processing → Status column',
      },
      {
        term: 'calculated',
        plain: 'Pay Has Been Computed',
        type: 'status',
        desc: 'The system has run all the pay formulas: After Advance, Pay, and Preparer Share are all filled in. The row is ready for distribution.',
        where: 'Payroll Processing → Status column',
      },
      {
        term: 'advance_applied',
        plain: 'Advance Deduction Has Been Applied',
        type: 'status',
        desc: 'The $100 advance fee has been subtracted for clients who requested a tax loan. After Advance is now the correct post-deduction value.',
        where: 'Payroll Processing → Status column',
      },
      {
        term: 'distributed',
        plain: 'Sent to the Correct Office Report Tab',
        type: 'status',
        desc: 'The row has been routed to the right office\'s report. It now appears in the Office Summary for the correct office.',
        where: 'Payroll Processing → Status column',
      },
      {
        term: 'sent',
        plain: 'Earnings Email Sent to the Preparer',
        type: 'status',
        desc: 'An earnings report email has been sent to this preparer\'s email address. They can view their weekly earnings breakdown.',
        where: 'Payroll Processing → Status column',
      },
      {
        term: 'archived',
        plain: 'Finalized and Stored',
        type: 'status',
        desc: 'The row has been fully processed and moved to long-term storage. It\'s part of the permanent record for this payroll period.',
        where: 'Payroll Processing → Status column',
      },
      {
        term: 'no_match',
        plain: '⚠ Could Not Identify the Preparer',
        type: 'status',
        desc: 'The PTIN appeared more than once in the lookup table but the row\'s EFIN didn\'t match any of them. The system can\'t tell which preparer this belongs to. Needs manual correction.',
        where: 'Payroll Processing → Status column (shown in red)',
      },
      {
        term: 'ptin_not_found',
        plain: '⚠ PTIN Not in the System',
        type: 'status',
        desc: 'The PTIN on this row doesn\'t exist anywhere in the Master PTIN (Preparers) table. Either the preparer hasn\'t been added yet, or the PTIN was entered incorrectly on the return.',
        where: 'Payroll Processing → Status column (shown in red)',
      },
      {
        term: 'missing_office',
        plain: '⚠ Can\'t Determine Which Office This Belongs To',
        type: 'status',
        desc: 'The preparer was found but their Tax Office field is blank or doesn\'t match any known office. Update the preparer\'s Tax Office in the Master PTIN table to fix this.',
        where: 'Payroll Processing → Status column (shown in orange)',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Report Files Explained',
    icon: FileText,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-500',
    entries: [
      {
        term: 'Payroll Report (Disbursement Listing)',
        plain: 'The Main Weekly Report — Who Got Paid What',
        type: 'text',
        desc: 'The primary source of truth for the week. This comes from Drake software and lists every client return filed, which preparer filed it, what EFIN/PTIN was used, and how much was collected in fees. Every pay calculation starts here.',
        where: 'Upload Center → Payroll Report',
      },
      {
        term: 'Backend Money Report',
        plain: 'Add-On Fee Revenue Coming Back to Offices',
        type: 'text',
        desc: 'Tracks the money from service bureau fees, software fees, and other add-on charges that flow back to each office. Uploaded separately because these fees are collected differently from the main prep fee.',
        where: 'Upload Center → Backend Money Report',
      },
      {
        term: 'Advance Report',
        plain: 'Who Took a Tax Refund Loan This Week',
        type: 'text',
        desc: 'Lists all taxpayers who applied for a tax advance (a loan against their expected refund). The system uses this to apply the $100 advance deduction and track funded, pending, and denied loan statuses.',
        where: 'Upload Center → Advance Report',
      },
      {
        term: 'Client Data Report',
        plain: 'Master Client List — Who Belongs to Which Preparer',
        type: 'text',
        desc: 'Contains the client records used to determine which preparer "owns" each taxpayer relationship. The system matches clients to rows using SSN last 4 + fuzzy name matching and fills the Client Belongs To field.',
        where: 'Upload Center → Client Data Report',
      },
      {
        term: 'Client Email Report',
        plain: 'Client Contact Info for Notifications',
        type: 'text',
        desc: 'A supplemental file that adds verified email addresses and phone numbers to client records. The system only fills in missing emails — it never overwrites an email that already exists.',
        where: 'Upload Center → Client Email Report',
      },
      {
        term: 'Fee Intercept Report',
        plain: 'Daily Record of Fees Collected from Refunds',
        type: 'text',
        desc: 'Tracks the fees that were automatically intercepted (deducted) from client refunds by the bank. Matched to offices by EFIN and aggregated into each office\'s total fees.',
        where: 'Upload Center → Fee Intercept Report',
      },
    ],
  },
  {
    id: 'matching',
    label: 'Matching & Fuzzy Logic',
    icon: Hash,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500',
    entries: [
      {
        term: 'Fuzzy Name Matching',
        plain: 'Finding the Right Person Even with Typos',
        type: 'text',
        desc: 'Instead of requiring an exact name match (which would fail if someone wrote "Jon" vs "John"), the system uses fuzzy matching — it looks for names that are close enough to be the same person. Combined with SSN last 4 for accuracy.',
        example: '"Jonathon Smith" matches "Jonathan Smith"',
        where: 'Client Data processing, Advance deduplication',
      },
      {
        term: 'PTIN Deduplication',
        plain: 'Handling Preparers with the Same PTIN',
        type: 'text',
        desc: 'Rare but possible: two records in the lookup table with the same PTIN. When this happens, the system also checks the EFIN to decide which record is the right match. If neither EFIN matches, the row gets a "No Match" status.',
        where: 'Payroll Processing — PTIN matching step',
      },
      {
        term: 'Advance Deduplication',
        plain: 'Handling Duplicate Advance Records',
        type: 'text',
        desc: 'If the same client (same SSN last 4 + name) appears twice in the Advance Report, the system keeps the most recent record but preserves the "Deducted" flag and any notes from the original. This prevents double-counting.',
        where: 'Advance Report processing',
      },
      {
        term: 'EFIN → Office Mapping',
        plain: 'Finding Which Office a Filing Belongs To',
        type: 'text',
        desc: 'The system maps a raw EFIN number to an office name by looking it up in the Master PTIN (Office) table\'s primary and secondary EFIN fields. Used for Fee Intercept matching and PTIN conflict resolution.',
        where: 'Fee Intercept processing, PTIN matching',
      },
    ],
  },
];

// ─── Type badge colors ─────────────────────────────────────────────────────────

const typeBadge: Record<string, string> = {
  text: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  number: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'yes/no': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  calculated: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  status: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  percent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

const typeLabel: Record<string, string> = {
  text: 'Text',
  number: 'Dollar Amount',
  'yes/no': 'Yes / No',
  calculated: 'Calculated',
  status: 'Status',
  percent: 'Percentage',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DataDictionaryPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        entries: cat.entries.filter(e =>
          e.term.toLowerCase().includes(q) ||
          e.plain.toLowerCase().includes(q) ||
          e.desc.toLowerCase().includes(q) ||
          (e.example?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .filter(cat => cat.entries.length > 0);
  }, [search]);

  const totalTerms = categories.reduce((sum, c) => sum + c.entries.length, 0);

  return (
    <div>
      <PageHeader
        title="Data Dictionary"
        description={`Plain-English guide to every term, field, and concept in the app — ${totalTerms} terms explained`}
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search any term, e.g. 'PTIN', 'AGI', 'transmitter', 'share'…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>

      {/* Type legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs text-muted-foreground self-center">Field types:</span>
        {Object.entries(typeLabel).map(([type, label]) => (
          <span key={type} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeBadge[type]}`}>{label}</span>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No terms found for "{search}"</p>
        </div>
      )}

      <div className="space-y-6">
        {filtered.map(cat => (
          <div key={cat.id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
              <div className={`p-1.5 rounded-md ${cat.bg}`}>
                <cat.icon className="h-3.5 w-3.5 text-white" />
              </div>
              <h3 className="text-sm font-semibold">{cat.label}</h3>
              <Badge variant="secondary" className="text-[10px] ml-auto">{cat.entries.length} term{cat.entries.length !== 1 ? 's' : ''}</Badge>
            </div>

            {/* Entries */}
            <div className="divide-y divide-border">
              {cat.entries.map(entry => (
                <div key={entry.term} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-2 mb-1.5">
                    <code className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{entry.term}</code>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeBadge[entry.type]}`}>{typeLabel[entry.type]}</span>
                    {entry.where && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">📍 {entry.where}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium mb-1">{entry.plain}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{entry.desc}</p>
                  {entry.example && (
                    <div className="mt-2 flex items-start gap-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 mt-0.5">Example:</span>
                      <span className="text-[10px] text-muted-foreground">{entry.example}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
