import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Users } from "lucide-react";
import { PageHeader } from "@/components/payroll/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/services/auditLog";
import { useAccount, type Account } from "@/contexts/AccountContext";

interface AccountUser { id: string; account_id: string; username: string; role: string; }

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `acct-${Date.now()}`;
}

export default function AccountsPage() {
  const { refresh } = useAccount();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Account | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [color, setColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [usersFor, setUsersFor] = useState<Account | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newUserRole, setNewUserRole] = useState("owner");

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AccountUser | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: u }] = await Promise.all([
      (supabase as any).from("accounts").select("*").order("parent_account_id", { nullsFirst: true }).order("name"),
      (supabase as any).from("account_users").select("*").order("username"),
    ]);
    setAccounts((a || []) as Account[]);
    setUsers((u || []) as AccountUser[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const parents = useMemo(() => accounts.filter((x) => !x.parent_account_id), [accounts]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setParentId(parents[0]?.id || "none");
    setColor("");
    setLogoUrl("");
    setEditOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setName(a.name);
    setParentId(a.parent_account_id || "none");
    setColor(a.branding_primary_color);
    setLogoUrl(a.branding_logo_url);
    setEditOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const payload = {
      name: name.trim(),
      slug: editing?.slug || slugify(name),
      parent_account_id: parentId === "none" ? null : parentId,
      branding_primary_color: color,
      branding_logo_url: logoUrl,
    };
    if (editing) {
      const { error } = await (supabase as any).from("accounts").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await logAudit({ action: "update", entityType: "account", entityId: editing.id, entityLabel: name, summary: `Updated sub-account "${name}".` });
    } else {
      const { data, error } = await (supabase as any).from("accounts").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logAudit({ action: "create", entityType: "account", entityId: data?.id, entityLabel: name, summary: `Created sub-account "${name}".` });
    }
    toast.success("Saved");
    setEditOpen(false);
    await load();
    await refresh();
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from("accounts").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "delete", entityType: "account", entityId: deleteTarget.id, entityLabel: deleteTarget.name, summary: `Deleted sub-account "${deleteTarget.name}" and all its data.` });
    toast.success(`Deleted "${deleteTarget.name}"`);
    setDeleteTarget(null);
    await load();
    await refresh();
  };

  const addUser = async () => {
    if (!usersFor || !newUsername.trim()) return;
    const { error } = await (supabase as any).from("account_users").insert({
      account_id: usersFor.id,
      username: newUsername.trim(),
      role: newUserRole,
    });
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "create", entityType: "account_user", entityLabel: `${newUsername} → ${usersFor.name}`, summary: `Granted ${newUserRole} access on "${usersFor.name}" to ${newUsername}.` });
    toast.success("User added");
    setNewUsername("");
    await load();
  };

  const removeUser = async () => {
    if (!deleteUserTarget) return;
    const acct = accounts.find((a) => a.id === deleteUserTarget.account_id);
    const { error } = await (supabase as any).from("account_users").delete().eq("id", deleteUserTarget.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "delete", entityType: "account_user", entityLabel: `${deleteUserTarget.username} → ${acct?.name || ''}`, summary: `Revoked access from ${deleteUserTarget.username}.` });
    setDeleteUserTarget(null);
    await load();
  };

  const usersByAccount = useMemo(() => {
    const m: Record<string, AccountUser[]> = {};
    users.forEach((u) => { (m[u.account_id] ||= []).push(u); });
    return m;
  }, [users]);

  return (
    <div>
      <PageHeader
        title="Sub-accounts"
        description="Manage isolated workspaces (GHL-style). Each sub-account has its own data, users, and branding."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New sub-account</Button>}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground p-6">Loading…</p>
      ) : (
        <div className="space-y-4">
          {parents.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{p.name} <span className="text-xs text-muted-foreground font-normal">(agency)</span></h3>
                  <p className="text-xs text-muted-foreground">{(usersByAccount[p.id]?.length || 0)} users</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setUsersFor(p)}><Users className="h-4 w-4 mr-1" />Users</Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-2">
                {accounts.filter((c) => c.parent_account_id === p.id).map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-surface-ash rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{(usersByAccount[c.id]?.length || 0)} users · slug {c.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setUsersFor(c)}><Users className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit sub-account" : "New sub-account"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. King J" /></div>
            <div className="space-y-1.5">
              <Label>Parent (leave empty to make this an agency)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None (agency) —</SelectItem>
                  {parents.filter((p) => p.id !== editing?.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Brand color (HSL, e.g. "45 80% 55%")</Label><Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="43 85% 55%" /></div>
            <div className="space-y-1.5"><Label>Logo URL</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users dialog */}
      <Dialog open={!!usersFor} onOpenChange={(o) => !o && setUsersFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Users on {usersFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(usersFor && usersByAccount[usersFor.id] || []).map((u) => (
              <div key={u.id} className="flex items-center justify-between bg-surface-ash rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{u.username}</p>
                  <p className="text-xs text-muted-foreground">{u.role}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteUserTarget(u)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {(!usersFor || !(usersByAccount[usersFor.id]?.length)) && <p className="text-sm text-muted-foreground">No users yet.</p>}
          </div>
          <div className="flex gap-2 items-end pt-2 border-t border-border">
            <div className="flex-1 space-y-1"><Label className="text-xs">Username</Label><Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. Michael" /></div>
            <div className="w-32 space-y-1"><Label className="text-xs">Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">owner</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="preparer">preparer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addUser}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityName={deleteTarget?.name}
        title="Delete sub-account?"
        description="All data scoped to this sub-account will be permanently removed."
        onConfirm={doDelete}
      />
      <ConfirmDeleteDialog
        open={!!deleteUserTarget}
        onOpenChange={(o) => !o && setDeleteUserTarget(null)}
        entityName={deleteUserTarget?.username}
        title="Revoke access?"
        confirmLabel="Revoke"
        onConfirm={removeUser}
      />
    </div>
  );
}