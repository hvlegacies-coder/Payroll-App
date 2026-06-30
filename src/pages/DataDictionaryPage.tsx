import { PageHeader } from '@/components/payroll/PageHeader';

const fields = [
  { category: 'Preparer Lookup', entries: [
    { field: 'ptin', type: 'string', desc: 'Preparer Tax ID Number — unique identifier for each preparer' },
    { field: 'contractor', type: 'string', desc: 'Full name of the tax preparer / contractor' },
    { field: 'tax_office', type: 'string', desc: 'Tax office the preparer belongs to' },
    { field: 'share_percent', type: 'number', desc: 'Percentage of received prep fee the preparer earns' },
    { field: 'efin', type: 'string', desc: 'Primary EFIN (Electronic Filing Identification Number)' },
    { field: 'efin2', type: 'string', desc: 'Secondary EFIN for shared filing scenarios' },
    { field: 'shared_efin_percent', type: 'number', desc: 'Share % when EFIN mismatch occurs' },
    { field: 'office_flat_rate', type: 'number', desc: 'Higher View: flat dollar rate when client does NOT belong to preparer' },
    { field: 'kingj_preparer_share', type: 'number', desc: 'King J-specific share percentage' },
    { field: 'owners_email', type: 'string', desc: 'Office owner email for sending reports' },
  ]},
  { category: 'Bucket Row', entries: [
    { field: 'efin', type: 'string', desc: 'EFIN from the imported payroll report' },
    { field: 'ptin', type: 'string', desc: 'PTIN from the imported payroll report' },
    { field: 'taxpayer_ssn_last4', type: 'string', desc: 'Last 4 digits of the taxpayer SSN' },
    { field: 'received_tax_prep_fees', type: 'number', desc: 'Actually received tax preparation fees' },
    { field: 'after_advance', type: 'number', desc: 'Computed: received - advance deduction' },
    { field: 'pay', type: 'number', desc: 'Computed: payout amount based on share percentages' },
    { field: 'preparer_share', type: 'number', desc: "Computed: preparer's portion of the payout" },
  ]},
  { category: 'Office Report', entries: [
    { field: 'total_received_prep_fee', type: 'number', desc: 'SUM of all received prep fees for the office' },
    { field: 'total_fees_due', type: 'number', desc: 'SUM(high_prep_fee + preparer_fee + fee_intercept + transmitter_above_10). Transmitter portion only counts the amount above $10 per row.' },
    { field: 'agi', type: 'number', desc: 'Total Received - Total Fees Due' },
    { field: 'net_pay', type: 'number', desc: 'AGI + Total Backend Money' },
  ]},
  { category: 'Tax Filing Fees (Glossary)', entries: [
    { field: 'ero_fee', type: 'fee', desc: 'ERO / Tax Preparation Fee — primary fee charged by the Electronic Return Originator for preparing the return (data entry, calculations, compliance). Varies by return complexity and preparer pricing. Usually the largest fee.' },
    { field: 'service_bureau_fee', type: 'fee', desc: 'Platform/infrastructure fee paid to the main office or franchise that provides tax software, support, and backend processing systems. Set by the main office and passed down to sub-offices. Often optional/configurable.' },
    { field: 'transmitter_fee', type: 'fee', desc: 'Charged for securely transmitting the return or bank product application to the IRS or processing center. Higher View payout = max(0, transmitter_fee − $10) per row: ≤ $10 yields $0, > $10 yields fee minus $10.' },
    { field: 'efile_fee', type: 'fee', desc: 'Electronic Filing Fee — charged by the ERO for submitting the return electronically instead of on paper. Includes pre-submission validation and faster authority confirmation. May be bundled with the transmitter fee.' },
    { field: 'fee_intercept', type: 'fee', desc: 'Process where tax preparation fees owed are automatically deducted ("intercepted") from the taxpayer\'s refund instead of being paid upfront. The bank product withholds the fees and disburses the remaining refund to the taxpayer.' },
  ]},
];

export default function DataDictionaryPage() {
  return (
    <div>
      <PageHeader title="Data Dictionary" description="Every important field, its type, and what it means" />
      <div className="space-y-6">
        {fields.map(cat => (
          <div key={cat.category} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="bg-surface-ash px-5 py-3 border-b border-border"><h3 className="text-sm font-semibold">{cat.category}</h3></div>
            <div className="divide-y divide-border">
              {cat.entries.map(entry => (
                <div key={entry.field} className="px-5 py-3 flex items-start gap-4">
                  <code className="text-xs font-mono bg-surface-ash px-2 py-0.5 rounded shrink-0 text-primary">{entry.field}</code>
                  <span className="text-[10px] font-mono text-muted-foreground bg-surface-ash px-1.5 py-0.5 rounded shrink-0">{entry.type}</span>
                  <span className="text-sm text-muted-foreground">{entry.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
