import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function DetailDrawer({ open, onClose, title, children, width = 'max-w-lg' }: DetailDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/10 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className={cn(
        'fixed right-0 top-0 h-full bg-card border-l border-border shadow-overlay z-50 animate-slide-in-right overflow-y-auto',
        width, 'w-full'
      )}>
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </>
  );
}
