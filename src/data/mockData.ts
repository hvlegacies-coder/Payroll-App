// Data cleared — ready for real uploaded data

export const offices: { id: string; name: string; taxOffice: string; mainOffice: string; landingTab: string; efin: string; efin2: string; ownerEmail: string; status: 'Active' | 'Inactive' }[] = [];

export const preparers: { id: string; ptin: string; name: string; taxOffice: string; mainOffice: string; landingTab: string; efin: string; efin2: string; sharePercent: number; sharedEfinPercent: number; preparerClientPercent: number; officeFlatRate: number; kingjPreparerShare: number; availedPayroll: number; active: boolean }[] = [];

export type PayrollStatus = 'Uploaded' | 'Validated' | 'Imported' | 'Needs Mapping' | 'Missing PTIN' | 'No Match' | 'Ready' | 'Advance Applied' | 'Calculated' | 'Distributed' | 'Sent' | 'Failed' | 'Archived';

export interface PayrollRow {
  id: string;
  batch: string;
  status: PayrollStatus;
  notes: string;
  // Raw file columns
  efin: string;
  parentEfin: string;
  groupEfin: string;
  ptin: string;
  taxpayerSsn: string;
  ssnLast4: string;
  taxpayerLastName: string;
  taxpayerFirstName: string;
  disbursementType: string;
  taxCustomerAccountNumber: string;
  cardNumber: string;
  applicationDate: string;
  fundingDate: string;
  fundingType: string;
  expectedRefund: number;
  actualRefund: number;
  customerDisbursementAmount: number;
  refundOffset: number;
  advanceRepayment: number;
  priorYearLoanDebt: number;
  refundProductFee: number;
  expectedTaxPrepFee: number;
  receivedTaxPrepFee: number;
  highPrepFee: number;
  taxPrepAfterHpFee: number;
  efinReceivingPrepFee: string;
  addOnFeeAmount: number;
  efinReceivingAddOnFee: string;
  eFileFee: number;
  efinReceivingEFileFee: string;
  serviceBureauFee: number;
  efinReceivingServiceBureauFee: string;
  transmitterFee: number;
  royaltyFee: number;
  efinReceivingRoyaltyFee: string;
  checkStatus: string;
  bankAccountNumber: string;
  bankRoutingNumber: string;
  taxpayerAddress: string;
  taxpayerCity: string;
  taxpayerState: string;
  taxpayerZipCode: string;
  taxpayerDob: string;
  spouseName: string;
  spouseDob: string;
  ero3Fee: number;
  ero4Fee: number;
  efinReceivingEro3Fee: string;
  efinReceivingEro4Fee: string;
  checkFee: number;
  checkFeeRebate: number;
  efinReceivingCheckFeeRebate: string;
  docPrepFee: number;
  docPrepFeeAfterBankFee: number;
  efinReceivingDocPrepFee: string;
  // Computed columns (values TBD)
  advanceRequested: boolean;
  afterAdvance: number;
  taxOffice: string;
  pay: number;
  preparer: string;
  clientBelongsTo: string;
  preparerShare: number;
}

export const payrollRows: PayrollRow[] = [];

export const advances: { id: string; ptin: string; preparerName: string; ssnLast4: string; taxpayerName: string; firstName: string; lastName: string; loanType: string; advanceAmount: number; outstandingBalance: number; status: string; repaymentStatus: string; fundingDate: string; deducted: boolean }[] = [];

export const uploads: { id: string; filename: string; type: string; uploadedBy: string; uploadedDate: string; rowsDetected: number; status: string }[] = [];

export const clients: { id: string; locationName: string; groupName: string; ssnEin: string; clientName: string; createdDate: string; formType: string; filingStatus: string; efiledDate: string; acceptedDate: string; submissionId: string; refund: number; preparedBy: string; email: string; duplicateMarker: boolean; clientBelongsTo: string }[] = [];

export const auditLogs: { id: string; timestamp: string; user: string; action: string; details: string; status: string; eventType: string; entity: string; entityId: string; notes: string }[] = [];

export const exports_: { id: string; name: string; type: string; date: string; status: string; rows: number }[] = [];

export const emails: { id: string; recipient: string; subject: string; date: string; status: string; office: string; recipients: string; sentBy: string; sentAt: string; error: string }[] = [];

export const weeklyPayrollTrend: { week: string; amount: number }[] = [];
