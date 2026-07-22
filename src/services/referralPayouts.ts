import { supabase } from '@/integrations/supabase/client';

export interface ReferralPayout {
  id: string;
  referrerName: string;
  referrerEmail: string;
  amount: number;
  method: string;
  status: string;
  date: string | null;
}

export interface ReferralOfficeMapping {
  id: string;
  referrer_name: string;
  referrer_email: string | null;
  office_name: string;
}

export async function fetchReferralPayouts(): Promise<ReferralPayout[]> {
  const { data, error } = await supabase.functions.invoke('get-referral-payouts');
  if (error) throw error;
  return (data?.payouts ?? []) as ReferralPayout[];
}

export async function fetchReferralOfficeMappings(): Promise<ReferralOfficeMapping[]> {
  const { data, error } = await (supabase as any)
    .from('referral_office_mapping')
    .select('id, referrer_name, referrer_email, office_name')
    .order('referrer_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReferralOfficeMapping[];
}

export async function upsertReferralOfficeMapping(
  referrerName: string,
  officeName: string,
  referrerEmail?: string,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('referral_office_mapping')
    .upsert(
      {
        referrer_name: referrerName,
        referrer_email: referrerEmail || null,
        office_name: officeName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'referrer_name' },
    );
  if (error) throw error;
}

export async function deleteReferralOfficeMapping(id: string): Promise<void> {
  const { error } = await (supabase as any).from('referral_office_mapping').delete().eq('id', id);
  if (error) throw error;
}
