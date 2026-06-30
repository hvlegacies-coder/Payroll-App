import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { isLockedPath } from "@/config/adminLock";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "hvt_admin_unlocked";
const TOKEN_KEY = "hvt_admin_lock_token";

type Ctx = {
  isUnlocked: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  isLocked: (path: string) => boolean;
  promptFor: string | null;
  requestUnlock: (path: string) => void;
  cancelPrompt: () => void;
};

const AdminLockContext = createContext<Ctx | null>(null);

export function AdminLockProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });
  const [promptFor, setPromptFor] = useState<string | null>(null);

  useEffect(() => {
    if (isUnlocked) sessionStorage.setItem(STORAGE_KEY, "1");
    else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }, [isUnlocked]);

  const unlock = useCallback(async (password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-access-password", {
        body: { scope: "admin_lock", password },
      });
      if (error || !data?.ok || !data?.token) return false;
      sessionStorage.setItem(TOKEN_KEY, data.token);
      setUnlocked(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const lock = useCallback(() => setUnlocked(false), []);
  const requestUnlock = useCallback((path: string) => setPromptFor(path), []);
  const cancelPrompt = useCallback(() => setPromptFor(null), []);

  return (
    <AdminLockContext.Provider
      value={{ isUnlocked, unlock, lock, isLocked: isLockedPath, promptFor, requestUnlock, cancelPrompt }}
    >
      {children}
    </AdminLockContext.Provider>
  );
}

export function useAdminLock() {
  const ctx = useContext(AdminLockContext);
  if (!ctx) throw new Error("useAdminLock must be used within AdminLockProvider");
  return ctx;
}