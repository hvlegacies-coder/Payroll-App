import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "preparer" | null;

type AuthCtx = {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = not known yet. Guards must wait for both, or a page refresh
  // redirects to /login before the saved session (and its role) has loaded.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<Role | undefined>(undefined);
  const userId = session?.user?.id;

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keyed on user id so token refreshes don't refetch the role.
  useEffect(() => {
    if (session === undefined) return;
    if (!userId) {
      setRole(null);
      return;
    }
    setRole(undefined);
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        const roles = (data ?? []).map((r: any) => r.role);
        setRole(roles.includes("admin") ? "admin" : roles.includes("preparer") ? "preparer" : null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, session === undefined]);

  const signOut = async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem("hvt_user");
      localStorage.removeItem("hvt_role");
    } catch {}
  };

  const loading = session === undefined || role === undefined;

  return (
    <Ctx.Provider value={{ session: session ?? null, user: session?.user ?? null, role: role ?? null, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
