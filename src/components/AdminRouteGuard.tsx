import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminLock } from "@/hooks/useAdminLock";

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { isUnlocked, isLocked, requestUnlock } = useAdminLock();
  const { pathname } = useLocation();

  if (!isLocked(pathname) || isUnlocked) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-card border border-border rounded-xl shadow-card p-8 max-w-sm w-full text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-surface-ash flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Restricted area</h2>
          <p className="text-sm text-muted-foreground mt-1">This page is password protected.</p>
        </div>
        <Button onClick={() => requestUnlock(pathname)} className="w-full">Enter password</Button>
      </div>
    </div>
  );
}