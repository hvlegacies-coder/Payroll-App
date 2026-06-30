export type Operator = '+' | '-' | '×' | '÷';

export interface FieldFilters {
  efin?: string;       // override per-field filter; '' / undefined = inherit table filter
  taxOffice?: string;  // override per-field filter; '' / undefined = inherit table filter
}

export interface CalcOperand {
  id: string;
  type: 'field' | 'constant';
  fieldId: string;     // when type=field; can be a registry id, '__table__<id>', or table-field id
  constant: string;    // when type=constant
  operator: Operator;  // operator BEFORE this operand (ignored for first)
  filters?: FieldFilters;
}

export interface TableField {
  id: string;          // unique instance id
  fieldId: string;     // references FieldDef.id or 'custom' or 'calculated'
  label: string;       // display label (renamable)
  type: 'field' | 'custom' | 'calculated';
  customValue?: number;
  formula?: string;    // legacy string formula (kept for back-compat)
  operands?: CalcOperand[]; // structured operands for calculated fields
  operator?: Operator; // operation applied AFTER this row
  filters?: FieldFilters; // per-field EFIN / Tax Office override
  negate?: boolean;    // when fieldId references a sibling table, multiply value by -1
  textColor?: string;  // optional text color (CSS color) applied to the row label & value
}

export interface TableFilter {
  efin: string;
  taxOffice: string;
  preparer: string;
}

export type FooterAggregation = 'running' | 'sum' | 'average' | 'min' | 'max' | 'count' | 'calculated' | 'none';

export interface SummaryTableConfig {
  id: string;
  title: string;
  fields: TableField[];
  filters: TableFilter;
  color?: string; // header color preset
  officeScope?: string; // page-level office filter (empty = all offices)
  footerAggregation?: FooterAggregation; // how to consolidate values in the footer (default: 'running')
  footerLabel?: string; // optional custom label override
  footerOperands?: CalcOperand[]; // operands when footerAggregation === 'calculated'
}
