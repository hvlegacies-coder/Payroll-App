import {
  PreparerLookup, BucketRow, BackendRow, AdvanceMaster,
  ClientData, ClientRef, OfficeReport, WeeklyHistory,
  ProcessingLog, PayrollRawImport,
} from '@/services/types';

// All data cleared — ready for real uploaded data

export const preparerLookups: PreparerLookup[] = [];
export const bucketRows: BucketRow[] = [];
export const backendRows: BackendRow[] = [];
export const advanceMaster: AdvanceMaster[] = [];
export const clientDataRows: ClientData[] = [];
export const clientData: ClientData[] = [];
export const clientRefs: ClientRef[] = [];
export const officeReports: OfficeReport[] = [];
export const weeklyHistory: WeeklyHistory[] = [];
export const processingLogs: ProcessingLog[] = [];
export const rawImports: PayrollRawImport[] = [];

export interface FeeIntercept {
  id: string;
  efin: string;
  ptin: string;
  ssn_last4: string;
  first_name: string;
  last_name: string;
  intercept_amount: number;
  source_import_id: string;
  created_at: string;
}

export const feeIntercepts: FeeIntercept[] = [];
