import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({
  children,
  require = "admin",
}: {
  children: React.ReactNode;
  require?: "admin" | "any" | "sub";
}) {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  // Sub-account users authenticate via localStorage (not Supabase auth).
  const subRole = typeof window !== "undefined" ? localStorage.getItem("hvt_role") : null;
  const subSlug = typeof window !== "undefined" ? localStorage.getItem("hvt_sub_slug") : null;
  const subToken = typeof window !== "undefined" ? localStorage.getItem("hvt_sub_token") : null;

  // Server-side verify the sub-account token on mount. localStorage flags alone
  // are no longer trusted to grant access.
  const [subTokenValid, setSubTokenValid] = useState<null | boolean>(null);
  useEffect(() => {
    if (require !== "sub") return;
    if (subRole !== "sub") return;
    if (!subToken) {
      setSubTokenValid(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-access-token", {
          body: { token: subToken, scope: "sub" },
        });
        if (cancelled) return;
        setSubTokenValid(!error && !!data?.ok);
      } catch {
        if (!cancelled) setSubTokenValid(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [require, subRole, subToken]);

  if (require === "sub") {
    if (subRole === "sub" && subSlug) {
      if (subTokenValid === true) return <>{children}</>;
      if (subTokenValid === false) {
        try {
          localStorage.removeItem("hvt_sub_token");
          localStorage.removeItem("hvt_role");
        } catch {}
        return <Navigate to="/login/sub" replace state={{ from: location.pathname }} />;
      }
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" />
        </div>
      );
    }
    // Admins can also access sub workspaces
    if (!loading && session && role === "admin") return <>{children}</>;
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" />
        </div>
      );
    }
    return <Navigate to="/login/sub" replace state={{ from: location.pathname }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(43,85%,55%)]" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (require === "admin" && role !== "admin") {
    // Preparers shouldn't land on the admin app
    if (role === "preparer") return <Navigate to="/my-earnings" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}