import { Building2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAccount } from "@/contexts/AccountContext";
import { useNavigate } from "react-router-dom";

export function AccountSwitcher() {
  const { accounts, activeAccount, setActiveAccountId } = useAccount();
  const navigate = useNavigate();
  if (!accounts.length) return null;
  const parents = accounts.filter((a) => !a.parent_account_id);
  const subs = accounts.filter((a) => a.parent_account_id);

  const handleSubClick = (a: typeof accounts[number]) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hvt_account_id", a.id);
    }
    navigate(`/sub/${a.slug}`);
  };

  const handleParentClick = (id: string) => {
    setActiveAccountId(id);
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2 max-w-[200px]">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate hidden sm:inline">
            {activeAccount?.name || "Select account"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {parents.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Agency</DropdownMenuLabel>
            {parents.map((a) => (
              <DropdownMenuItem key={a.id} onClick={() => handleParentClick(a.id)} className="flex items-center justify-between">
                <span>{a.name}</span>
                {activeAccount?.id === a.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {subs.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Sub-accounts</DropdownMenuLabel>
            {subs.map((a) => (
              <DropdownMenuItem key={a.id} onClick={() => handleSubClick(a)} className="flex items-center justify-between">
                <span>{a.name}</span>
                {activeAccount?.id === a.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/accounts")}>Manage sub-accounts</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}