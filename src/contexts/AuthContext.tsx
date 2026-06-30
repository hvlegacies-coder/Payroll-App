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
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe synchronously
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer DB call out of the auth callback
        setTimeout(async () => {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", s.user.id);
          const roles = (data ?? []).map((r: any) => r.role);
          setRole(roles.includes("admin") ? "admin" : roles.includes("preparer") ? "preparer" : null);
        }, 0);
      } else {
        setRole(null);
      }
    });

    // Then load existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) setLoading(false);
    else if (role !== null || !session?.user) setLoading(false);
    else {
      // Resolve role if not yet set after we have a session
      (async () => {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        const roles = (data ?? []).map((r: any) => r.role);
        setRole(
          roles.includes("admin") ? "admin" : roles.includes("preparer") ? "preparer" : null
        );
        setLoading(false);
      })();
    }
  }, [session, role]);

  const signOut = async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem("hvt_user");
      localStorage.removeItem("hvt_role");
    } catch {}
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, role, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}