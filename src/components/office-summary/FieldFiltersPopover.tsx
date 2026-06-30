import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldFilters } from './types';

interface Props {
  value?: FieldFilters;
  onChange: (next: FieldFilters | undefined) => void;
  efinOptions: string[];
  officeOptions: string[];
  inheritEfin?: string;
  inheritTaxOffice?: string;
  size?: 'sm' | 'xs';
}

export function FieldFiltersPopover({
  value, onChange, efinOptions, officeOptions, inheritEfin, inheritTaxOffice, size = 'sm',
}: Props) {
  const hasOverride = !!(value?.efin || value?.taxOffice);
  const set = (k: 'efin' | 'taxOffice', v: string) => {
    const next: FieldFilters = { ...(value || {}) };
    if (v === '__inherit__') delete next[k]; else next[k] = v;
    const cleaned = (!next.efin && !next.taxOffice) ? undefined : next;
    onChange(cleaned);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            size === 'xs' ? 'h-5 w-5' : 'h-6 w-6',
            hasOverride && 'text-primary',
          )}
          title="Filter this value by EFIN / Tax Office"
        >
          <Filter className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="end">
        <div>
          <Label className="text-xs">EFIN</Label>
          <Select
            value={value?.efin || '__inherit__'}
            onValueChange={v => set('efin', v)}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit__">
                Inherit{inheritEfin ? ` (${inheritEfin})` : ' (All)'}
              </SelectItem>
              {efinOptions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tax Office</Label>
          <Select
            value={value?.taxOffice || '__inherit__'}
            onValueChange={v => set('taxOffice', v)}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit__">
                Inherit{inheritTaxOffice ? ` (${inheritTaxOffice})` : ' (All)'}
              </SelectItem>
              {officeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasOverride && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => onChange(undefined)}
          >
            Clear overrides
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
