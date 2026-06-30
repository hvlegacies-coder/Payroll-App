import { useEffect, useState, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: ReactNode;
  entityName?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

const REQUIRED = "DELETE";

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Confirm deletion",
  description,
  entityName,
  confirmLabel = "Delete",
  onConfirm,
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setText("");
      setBusy(false);
    }
  }, [open]);

  const enabled = text === REQUIRED && !busy;

  const handleConfirm = async () => {
    if (!enabled) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              {entityName && (
                <DialogDescription className="mt-1">
                  This will permanently delete <span className="font-medium text-foreground">{entityName}</span>.
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
        <div className="space-y-2">
          <Label htmlFor="confirm-delete-input" className="text-xs">
            Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete-input"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DELETE"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!enabled}>
            {busy ? "Deleting..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}