import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Operator } from './types';

const OPS: Operator[] = ['+', '-', '×', '÷'];

interface Props {
  operator?: Operator;
  onChange: (op: Operator | undefined) => void;
}

export function OperatorRow({ operator, onChange }: Props) {
  return (
    <div className="flex justify-center -my-1 relative z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-4 w-4 rounded-full p-0 text-[10px] leading-none border bg-background shadow-sm',
              operator
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground/50 hover:text-foreground',
            )}
            title={operator ? `Operator: ${operator} (click to change)` : 'Set operator with next row'}
          >
            {operator ?? '·'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-0 p-1">
          <div className="flex gap-0.5">
            {OPS.map(op => (
              <button
                key={op}
                onClick={() => onChange(operator === op ? undefined : op)}
                className={cn(
                  'h-6 w-6 rounded text-xs hover:bg-accent',
                  operator === op && 'bg-primary text-primary-foreground hover:bg-primary',
                )}
              >
                {op}
              </button>
            ))}
          </div>
          {operator && (
            <DropdownMenuItem
              onClick={() => onChange(undefined)}
              className="text-[10px] text-muted-foreground justify-center mt-1"
            >
              Clear
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
