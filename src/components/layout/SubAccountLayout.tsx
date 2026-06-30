import { Outlet, useNavigate, useParams, Link } from "react-router-dom";
import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/AccountContext";
import { useEffect, useMemo } from "react";
import { useActiveWeek } from "@/hooks/useActiveWeek";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountSwitcher } from "./AccountSwitcher";

export function SubAccountLayout() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { accounts } = useAccount();
  const { weeks, selectedWeek, setSelectedWeek } = useActiveWeek();
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("hvt_role") !== "sub";
  const subAccount = useMemo(
    () => accounts.find((a) => a.slug === slug) || null,
    [accounts, slug],
  );

  // Gate access: must be logged in as a sub-account user for this slug (or admin).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = localStorage.getItem("hvt_role");
    const scope = localStorage.getItem("hvt_sub_slug");
    if (role === "sub" && scope && scope !== slug) {
      // Sub user trying to access a different sub — bounce them.
      navigate(`/sub/${scope}`, { replace: true });
    }
  }, [slug, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("hvt_user");
    localStorage.removeItem("hvt_role");
    localStorage.removeItem("hvt_sub_slug");
    localStorage.removeItem("hvt_account_id");
    navigate("/login/sub", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] bg-surface-ash">
      <header className="h-14 lg:h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
        <Link to={`/sub/${slug}`} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{subAccount?.name || slug}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sub-account workspace</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && <AccountSwitcher />}
          {weeks.length > 0 && (
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w.id} value={w.label} className="text-xs">
                    {w.label}{w.is_active ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>
      <main className="p-3 sm:p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
}