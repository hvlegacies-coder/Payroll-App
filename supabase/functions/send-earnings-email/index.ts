import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeekData {
  week_label: string;
  total_received: number;
  total_share: number;
  preparer_fee: number;
  total_high_prep_fee: number;
  total_after_advance: number;
  total_pay: number;
  preparer_name: string;
  row_data: any[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { recipientEmail, preparerName, allWeeks, selectedWeek } = await req.json();

    if (!recipientEmail || !allWeeks || !selectedWeek) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weeks = (allWeeks as WeekData[]);
    const grandReceived = weeks.reduce((s, w) => s + (Number(w.total_received) || 0), 0);
    const grandShare = weeks.reduce((s, w) => s + (Number(w.total_share) || 0), 0);
    const grandFee = weeks.reduce((s, w) => s + (Number(w.preparer_fee) || 0), 0);
    const grandReturns = weeks.reduce((s, w) => s + ((w.row_data || []).length), 0);

    const weeksSummary = weeks.map(w => ({
      week_label: w.week_label,
      total_received: Number(w.total_received) || 0,
      total_share: Number(w.total_share) || 0,
      preparer_fee: Number(w.preparer_fee) || 0,
      returns_count: (w.row_data || []).length,
    }));

    const sw = selectedWeek as WeekData;
    const detailRows = (sw.row_data || []).map((r: any) => ({
      taxpayer: `${r.taxpayer_last_name || ''}, ${r.taxpayer_first_name || ''}`.replace(/^, |, $/, '') || '—',
      efin: r.efin || '—',
      received: Number(r.received_tax_prep_fees ?? r.receivedFee ?? 0),
      highPrep: Number(r.high_prep_fee ?? r.highPrepFee ?? 0),
      afterAdvance: Number(r.after_advance ?? r.afterAdvance ?? 0),
      share: Number(r.preparer_share ?? r.preparerShare ?? 0),
    }));

    // Call send-transactional-email
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'earnings-report',
        recipientEmail,
        idempotencyKey: `earnings-${preparerName}-${Date.now()}`,
        templateData: {
          preparerName,
          grandReceived,
          grandShare,
          grandFee,
          grandReturns,
          weeks: weeksSummary,
          detailRows,
          selectedWeekLabel: sw.week_label,
        },
      },
    });

    if (error) {
      console.error("send-transactional-email error:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
