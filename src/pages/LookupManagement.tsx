import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/payroll/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { Building2, DollarSign, Percent, X, ChevronDown, ChevronRight, Equal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/utils';

type FeeType = 'E-File Fee(s)' | 'Service Bureau Fee' | 'ERO3Fee' | 'Transmitter Fee';

interface OfficeFeeSetting {
  office_name: string;
  mode: 'percentage' | 'flat_rate' | 'remaining';
  value: number;
}

interface OfficeFeeConfig {
  [feeType: string]: OfficeFeeSetting[];
}

interface AllOfficeConfigs {
  [officeName: string]: OfficeFeeConfig;
}

const FEE_TYPES: FeeType[] = ['E-File Fee(s)', 'Service Bureau Fee', 'ERO3Fee', 'Transmitter Fee'];

export default function LookupManagement() {
  const [offices, setOffices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [allConfigs, setAllConfigs] = useState<AllOfficeConfigs>({});
  const [expandedFee, setExpandedFee] = useState<FeeType | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ fee: FeeType; office: string } | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // Load offices and saved configs in parallel
      const [officesRes, configsRes] = await Promise.all([
        supabase.from('offices').select('office_name').eq('active', true).order('office_name'),
        supabase.from('office_fee_configs').select('*'),
      ]);
      if (officesRes.data) setOffices(officesRes.data.map(o => o.office_name).filter(Boolean));
      if (configsRes.data && configsRes.data.length > 0) {
        const loaded: AllOfficeConfigs = {};
        for (const row of configsRes.data) {
          if (!loaded[row.office_name]) loaded[row.office_name] = {};
          if (!loaded[row.office_name][row.fee_type]) loaded[row.office_name][row.fee_type] = [];
          loaded[row.office_name][row.fee_type].push({
            office_name: row.target_office,
            mode: row.mode as 'percentage' | 'flat_rate' | 'remaining',
            value: Number(row.value),
          });
        }
        setAllConfigs(loaded);
      }
      setLoading(false);
    })();
  }, []);

  const getConfig = (): OfficeFeeConfig => selectedOffice ? (allConfigs[selectedOffice] || {}) : {};

  const getSelectedOffices = (fee: FeeType): OfficeFeeSetting[] => getConfig()[fee] || [];

  const updateConfig = (updater: (prev: OfficeFeeConfig) => OfficeFeeConfig) => {
    if (!selectedOffice) return;
    setAllConfigs(prev => ({
      ...prev,
      [selectedOffice]: updater(prev[selectedOffice] || {}),
    }));
  };

  const toggleOfficeForFee = (fee: FeeType, officeName: string) => {
    updateConfig(prev => {
      const current = prev[fee] || [];
      const exists = current.find(e => e.office_name === officeName);
      if (exists) {
        return { ...prev, [fee]: current.filter(e => e.office_name !== officeName) };
      }
      return { ...prev, [fee]: [...current, { office_name: officeName, mode: 'percentage', value: 0 }] };
    });
  };

  const isOfficeSelected = (fee: FeeType, officeName: string) =>
    (getConfig()[fee] || []).some(e => e.office_name === officeName);

  const updateEntry = (fee: FeeType, officeName: string, updates: Partial<OfficeFeeSetting>) => {
    updateConfig(prev => ({
      ...prev,
      [fee]: (prev[fee] || []).map(e => e.office_name === officeName ? { ...e, ...updates } : e),
    }));
  };

  const removeOfficeFromFee = (fee: FeeType, officeName: string) => {
    updateConfig(prev => ({
      ...prev,
      [fee]: (prev[fee] || []).filter(e => e.office_name !== officeName),
    }));
    if (editingEntry?.fee === fee && editingEntry?.office === officeName) setEditingEntry(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build flat rows from allConfigs
      const rows: { office_name: string; fee_type: string; target_office: string; mode: string; value: number }[] = [];
      for (const [officeName, feeConfig] of Object.entries(allConfigs)) {
        for (const [feeType, entries] of Object.entries(feeConfig)) {
          for (const entry of entries) {
            rows.push({
              office_name: officeName,
              fee_type: feeType,
              target_office: entry.office_name,
              mode: entry.mode,
              value: entry.value,
            });
          }
        }
      }

      // Delete all existing configs and re-insert
      await supabase.from('office_fee_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (rows.length > 0) {
        const { error } = await supabase.from('office_fee_configs').insert(rows);
        if (error) throw error;
      }
      toast.success('Backend configuration saved.');
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Backend Breakdown" description="Configure backend fee calculations per office" />
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading offices…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Backend Breakdown"
        description="Configure backend fee calculations per office"
        actions={<Button onClick={handleSave} disabled={saving} className="gap-2"><DollarSign className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Configuration'}</Button>}
      />

      {/* Office selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
        {offices.map(office => (
          <button
            key={office}
            onClick={() => setSelectedOffice(selectedOffice === office ? null : office)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              selectedOffice === office
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border bg-card hover:bg-muted hover:border-primary/30'
            }`}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{office}</span>
          </button>
        ))}
      </div>

      {selectedOffice && (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {selectedOffice} — Fee Configuration
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Select offices for each fee type, then configure percentage or flat rate.</p>
          </div>

          <div className="divide-y divide-border">
            {FEE_TYPES.map(fee => {
              const isExpanded = expandedFee === fee;
              const selected = getSelectedOffices(fee);

              return (
                <div key={fee}>
                  {/* Fee header */}
                  <button
                    onClick={() => setExpandedFee(isExpanded ? null : fee)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{fee}</span>
                      {selected.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{selected.length} office{selected.length !== 1 ? 's' : ''}</Badge>
                      )}
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-6 pb-5 space-y-4">
                      {/* Office multi-select */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Select offices for this fee:</p>
                        <div className="flex flex-wrap gap-2">
                          {offices.map(office => (
                            <label
                              key={office}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                isOfficeSelected(fee, office)
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:bg-muted'
                              }`}
                            >
                              <Checkbox
                                checked={isOfficeSelected(fee, office)}
                                onCheckedChange={() => toggleOfficeForFee(fee, office)}
                                className="h-3.5 w-3.5"
                              />
                              {office}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Selected offices with config */}
                      {selected.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Configure values (click to edit):</p>
                          <div className="space-y-2">
                            {selected.map(entry => {
                              const isEditing = editingEntry?.fee === fee && editingEntry?.office === entry.office_name;

                              return (
                                <div
                                  key={entry.office_name}
                                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                                    isEditing ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40 cursor-pointer'
                                  }`}
                                  onClick={() => !isEditing && setEditingEntry({ fee, office: entry.office_name })}
                                >
                                  <span className="text-sm font-medium min-w-[140px]">{entry.office_name}</span>

                                  {isEditing ? (
                                    <div className="flex items-center gap-3 flex-1">
                                      {/* Mode toggle */}
                                      <div className="flex rounded-lg border border-border overflow-hidden">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); updateEntry(fee, entry.office_name, { mode: 'percentage' }); }}
                                          className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                                            entry.mode === 'percentage' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                          }`}
                                        >
                                          <Percent className="h-3 w-3" /> Percentage
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); updateEntry(fee, entry.office_name, { mode: 'flat_rate' }); }}
                                          className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                                            entry.mode === 'flat_rate' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                          }`}
                                        >
                                          <DollarSign className="h-3 w-3" /> Flat Rate
                                        </button>
                                        {selected.length >= 2 && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); updateEntry(fee, entry.office_name, { mode: 'remaining', value: 0 }); }}
                                            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                                              entry.mode === 'remaining' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                            }`}
                                          >
                                            <Equal className="h-3 w-3" /> Remaining
                                          </button>
                                        )}
                                      </div>

                                      {/* Value input (hidden for remaining) */}
                                      {entry.mode !== 'remaining' && (
                                        <div className="relative w-32">
                                          {entry.mode === 'flat_rate' && (
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                          )}
                                          <Input
                                            type="number"
                                            min={entry.mode === 'percentage' ? 1 : 0}
                                            max={entry.mode === 'percentage' ? 100 : undefined}
                                            step={entry.mode === 'percentage' ? 1 : 0.01}
                                            value={entry.value || ''}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => {
                                              let val = parseFloat(e.target.value) || 0;
                                              if (entry.mode === 'percentage') val = Math.min(100, Math.max(0, val));
                                              updateEntry(fee, entry.office_name, { value: val });
                                            }}
                                            className={`h-8 text-xs font-mono ${entry.mode === 'flat_rate' ? 'pl-7' : ''}`}
                                            placeholder={entry.mode === 'percentage' ? '1–100' : '0.00'}
                                          />
                                          {entry.mode === 'percentage' && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                          )}
                                        </div>
                                      )}

                                      {entry.mode === 'remaining' && (
                                        <span className="text-xs text-muted-foreground italic">Auto-calculated</span>
                                      )}

                                      {/* Done button */}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs"
                                        onClick={(e) => { e.stopPropagation(); setEditingEntry(null); }}
                                      >
                                        Done
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-1">
                                      <Badge variant="outline" className="text-xs">
                                        {entry.mode === 'percentage' ? <Percent className="h-3 w-3 mr-1" /> : entry.mode === 'flat_rate' ? <DollarSign className="h-3 w-3 mr-1" /> : <Equal className="h-3 w-3 mr-1" />}
                                        {entry.mode === 'percentage' ? `${entry.value}%` : entry.mode === 'flat_rate' ? formatMoney(entry.value) : 'Remaining'}
                                      </Badge>
                                    </div>
                                  )}

                                  {/* Remove */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeOfficeFromFee(fee, entry.office_name); }}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selectedOffice && offices.length > 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select an office above to configure its backend fee calculations.</p>
        </div>
      )}
    </div>
  );
}
