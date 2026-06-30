import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useAdminLock } from "@/hooks/useAdminLock";

export function AdminLockDialog() {
  const { promptFor, cancelPrompt, unlock } = useAdminLock();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (promptFor) {
      setPassword("");
      setError(null);
    }
  }, [promptFor]);

  const [busy, setBusy] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await unlock(password);
    setBusy(false);
    if (ok) {
      const target = promptFor;
      cancelPrompt();
      if (target) navigate(target);
    } else {
      setError("Incorrect password");
      setPassword("");
    }
  };

  return (
    <Dialog open={!!promptFor} onOpenChange={(o) => !o && cancelPrompt()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Restricted area
          </DialogTitle>
          <DialogDescription>Enter the admin password to access this section.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error && <p className="text-xs text-status-negative">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancelPrompt}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Checking…" : "Unlock"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}