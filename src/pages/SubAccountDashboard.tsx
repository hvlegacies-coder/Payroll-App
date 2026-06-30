import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/AccountContext";
import { getSubAccountOffices, rowMatchesSubAccount } from "@/config/subAccountOffices";
import { ensureTotalsTemplateFields } from "@/config/subSummaryTables";
import { SubLayoutRouter } from "@/components/sub-layouts";
import type { SubPreparer } from "@/components/sub-layouts/types";
import type { SummaryTableConfig } from "@/components/office-summary/types";

export default function SubAccountDashboard() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { accounts, activeAccount, setActiveAccountId, setActiveAccountIdSilent, loading: accountsLoading } = useAccount();

  const subAccount = useMemo(
    () => accounts.find((a) => a.slug === slug) || null,
    [accounts, slug],
  );
  const offices = useMemo(() => getSubAccountOffices(slug), [slug]);
  const agency = useMemo(() => accounts.find((a) => !a.parent_account_id) || null, [accounts]);

  const [preparers, setPreparers] = useState<SubPreparer[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryTables, setSummaryTables] = useState<SummaryTableConfig[]>([]);
  const [officesHiddenKeys, setOfficesHiddenKeys] = useState<string[]>([]);
  const [adminHiddenKeys, setAdminHiddenKeys] = useState<string[]>([]);
  const [agencyHiddenKeys, setAgencyHiddenKeys] = useState<string[]>([]);
  const isSubUser = typeof window !== "undefined" && localStorage.getItem("hvt_role") === "sub";
  const isAdmin = !isSubUser;
  const officeScope = offices[0] || "";

  // Load saved Office Summary table configs for this sub-account's office
  useEffect(() => {
    if (!officeScope) { setSummaryTables([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("office_summary_configs")
        .select("tables")
        .eq("office_name", officeScope)
        .maybeSingle();
      if (!cancelled) {
        const loaded = ((data?.tables as unknown) as SummaryTableConfig[]) || [];
        setSummaryTables(ensureTotalsTemplateFields(loaded));
      }
    })();
    return () => { cancelled = true; };
  }, [officeScope]);

  // Load hidden table keys for this sub-account/office (offices + admin scope + agency-offices)
  useEffect(() => {
    if (!officeScope || !slug) {
      setOfficesHiddenKeys([]); setAdminHiddenKeys([]); setAgencyHiddenKeys([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: officesRow }, { data: adminRow }, { data: agencyRow }] = await Promise.all([
        (supabase as any)
          .from("sub_account_table_visibility")
          .select("hidden_keys")
          .eq("slug", slug)
          .eq("office_name", officeScope)
          .maybeSingle(),
        (supabase as any)
          .from("sub_account_table_visibility")
          .select("hidden_keys")
          .eq("slug", `${slug}__admin`)
          .eq("office_name", officeScope)
          .maybeSingle(),
        (supabase as any)
          .from("sub_account_table_visibility")
          .select("hidden_keys")
          .eq("slug", "__agency_offices__")
          .eq("office_name", officeScope)
          .maybeSingle(),
      ]);
      if (!cancelled) {
        setOfficesHiddenKeys(((officesRow?.hidden_keys as unknown) as string[]) || []);
        setAdminHiddenKeys(((adminRow?.hidden_keys as unknown) as string[]) || []);
        setAgencyHiddenKeys(((agencyRow?.hidden_keys as unknown) as string[]) || []);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, officeScope]);

  const persistHidden = async (storageSlug: string, next: string[]) => {
    await (supabase as any)
      .from("sub_account_table_visibility")
      .upsert(
        { slug: storageSlug, office_name: officeScope, hidden_keys: next, updated_at: new Date().toISOString() },
        { onConflict: "slug,office_name" },
      );
  };

  const onToggleHiddenScoped = async (key: string, scope: "admin" | "offices") => {
    if (!officeScope || !slug) return;
    if (scope === "admin") {
      const next = adminHiddenKeys.includes(key)
        ? adminHiddenKeys.filter((k) => k !== key)
        : [...adminHiddenKeys, key];
      setAdminHiddenKeys(next);
      await persistHidden(`${slug}__admin`, next);
    } else {
      const next = officesHiddenKeys.includes(key)
        ? officesHiddenKeys.filter((k) => k !== key)
        : [...officesHiddenKeys, key];
      setOfficesHiddenKeys(next);
      await persistHidden(slug, next);
    }
  };

  // Sub user only ever toggles their own view (offices scope).
  const onToggleHidden = (key: string) => onToggleHiddenScoped(key, "offices");

  // Sync active account to this sub-account
  useEffect(() => {
    if (subAccount && activeAccount?.id !== subAccount.id) {
      setActiveAccountIdSilent(subAccount.id);
    }
  }, [subAccount, activeAccount, setActiveAccountIdSilent]);

  useEffect(() => {
    if (!subAccount) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: prepData } = await supabase
        .from("preparers")
        .select("*")
        .order("contractor");
      const matchedPreps = (prepData || []).filter((p: any) =>
        rowMatchesSubAccount(p.tax_office, slug) || rowMatchesSubAccount(p.main_office, slug),
      ) as SubPreparer[];

      if (!cancelled) {
        setPreparers(matchedPreps);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subAccount, slug]);

  if (accountsLoading) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subAccount) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Sub-account "{slug}" not found.{" "}
          <Link to="/accounts" className="text-primary underline">Manage sub-accounts</Link>
        </p>
      </div>
    );
  }

  const backToAgency = () => {
    if (agency) setActiveAccountId(agency.id);
    else navigate("/");
  };

  return (
    <div>
      {typeof window !== "undefined" && localStorage.getItem("hvt_role") !== "sub" && (
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" className="gap-1" onClick={backToAgency}>
            <ArrowLeft className="h-4 w-4" /> Back to Agency
          </Button>
          <span className="text-xs text-muted-foreground">/ Sub-accounts / {subAccount.name}</span>
        </div>
      )}
      {!officeScope ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No office mapping configured for this sub-account.
        </p>
      ) : (
        <SubLayoutRouter
          subName={subAccount.name}
          slug={slug}
          officeScope={officeScope}
          offices={offices}
          summaryTables={summaryTables}
          setSummaryTables={setSummaryTables}
          preparers={preparers}
          isSubUser={isSubUser}
          loading={loading}
          hiddenKeys={
            isAdmin
              ? adminHiddenKeys
              : Array.from(new Set([...officesHiddenKeys, ...agencyHiddenKeys]))
          }
          officesHiddenKeys={officesHiddenKeys}
          isAdmin={isAdmin}
          onToggleHidden={onToggleHidden}
          onToggleHiddenScoped={onToggleHiddenScoped}
        />
      )}
    </div>
  );
}
