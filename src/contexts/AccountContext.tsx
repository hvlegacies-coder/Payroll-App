import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Account {
  id: string;
  name: string;
  slug: string;
  parent_account_id: string | null;
  branding_logo_url: string;
  branding_primary_color: string;
  active: boolean;
}

interface Ctx {
  accounts: Account[];
  activeAccount: Account | null;
  activeAccountId: string | null;
  setActiveAccountId: (id: string) => void;
  setActiveAccountIdSilent: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const AccountContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "hvt_account_id";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const username = typeof window !== "undefined" ? localStorage.getItem("hvt_user") : null;
    let query = (supabase as any).from("accounts").select("*").eq("active", true).order("parent_account_id", { nullsFirst: true }).order("name");
    const { data: all } = await query;
    const list = (all || []) as Account[];

    let visible = list;
    if (username) {
      const { data: links } = await (supabase as any)
        .from("account_users")
        .select("account_id")
        .eq("username", username);
      const ids = new Set((links || []).map((l: any) => l.account_id));
      // If user is linked to any accounts, restrict; otherwise show all (legacy users).
      // Also include all sub-accounts of any parent the user is linked to.
      if (ids.size > 0) {
        const parentIds = new Set(
          list.filter((a) => !a.parent_account_id && ids.has(a.id)).map((a) => a.id),
        );
        visible = list.filter(
          (a) => ids.has(a.id) || (a.parent_account_id && parentIds.has(a.parent_account_id)),
        );
      }
    }
    setAccounts(visible);
    setLoading(false);

    // Pick a default if none set or stored one is no longer accessible
    if (visible.length > 0) {
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const valid = stored && visible.find((a) => a.id === stored);
      if (!valid) {
        const parent = visible.find((a) => !a.parent_account_id) || visible[0];
        setActiveAccountIdState(parent.id);
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, parent.id);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
    // Force a refresh so all data refetches under the new scope
    setTimeout(() => window.location.reload(), 50);
  }, []);

  const setActiveAccountIdSilent = useCallback((id: string) => {
    setActiveAccountIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId],
  );

  return (
    <AccountContext.Provider
      value={{ accounts, activeAccount, activeAccountId, setActiveAccountId, setActiveAccountIdSilent, refresh, loading }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}

/** Returns the active account_id for use inside Supabase queries. */
export function getActiveAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}