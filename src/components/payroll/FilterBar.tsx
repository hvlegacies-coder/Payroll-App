import { Search, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface FilterOption {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  multi?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
}

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
}

export function FilterBar({ search, onSearchChange, searchPlaceholder = 'Search...', filters = [] }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 h-9 bg-card"
        />
      </div>
      {filters.map((filter, i) => {
        if (filter.multi) {
          const selected = filter.values || [];
          const toggle = (v: string) => {
            const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
            filter.onValuesChange?.(next);
          };
          return (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] h-9 bg-card justify-between font-normal">
                  <span className="truncate">
                    {filter.label}{selected.length > 0 ? ` (${selected.length})` : ''}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                {selected.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs justify-start mb-1"
                    onClick={() => filter.onValuesChange?.([])}
                  >
                    Clear ({selected.length})
                  </Button>
                )}
                <div className="max-h-64 overflow-y-auto">
                  {filter.options.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No {filter.label.toLowerCase()}</div>
                  ) : filter.options.map(opt => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.includes(opt.value)}
                        onCheckedChange={() => toggle(opt.value)}
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <Select key={i} value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger className="w-[160px] h-9 bg-card">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {filter.label}</SelectItem>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
}
