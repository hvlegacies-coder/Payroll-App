// Maps an account slug (sub-account) to one or more office names used in
// `preparers.tax_office`, `bucketRows.tax_office`, and client data fields.
// The first entry is the canonical office shown to the user.
export const SUB_ACCOUNT_OFFICES: Record<string, string[]> = {
  "d-and-d": ["D & D", "D&D", "Tax Champions"],
  "king-j": ["King J", "King J HQ"],
  "main-event": ["Main Event"],
  "powerplay": ["PowerPlay", "Powerplay"],
  "s-and-c": ["S & C", "S&C"],
};

export function getSubAccountOffices(slug: string | undefined | null): string[] {
  if (!slug) return [];
  return SUB_ACCOUNT_OFFICES[slug] || [];
}

const norm = (s: string) => (s || "").replace(/\s+/g, "").toLowerCase();

export function rowMatchesSubAccount(officeValue: string | null | undefined, slug: string): boolean {
  const offices = getSubAccountOffices(slug);
  if (offices.length === 0) return false;
  const v = norm(officeValue || "");
  return offices.some((o) => norm(o) === v);
}
