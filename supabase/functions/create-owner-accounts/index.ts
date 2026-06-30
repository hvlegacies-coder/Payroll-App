import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // username (lowercased) -> email. Password is the same for all (Hello2026!).
  // Every owner gets the 'admin' role; office routing is handled client-side.
  const owners: { username: string; email: string }[] = [
    { username: "Payroll", email: "payroll@hvtaxprep.com" },
    { username: "Michael", email: "michael@hvtaxprep.com" },
    { username: "OlBrown", email: "olbrown@hvtaxprep.com" },
    { username: "Julius", email: "julius@hvtaxprep.com" },
    { username: "higherview", email: "higherview@hvtaxprep.com" },
    { username: "d&d", email: "dd@hvtaxprep.com" },
    { username: "powerplay", email: "powerplay@hvtaxprep.com" },
    { username: "s&c", email: "sc@hvtaxprep.com" },
    { username: "main event", email: "mainevent@hvtaxprep.com" },
    { username: "kingj", email: "kingj@hvtaxprep.com" },
  ];

  const password = "Hello2026!";
  const results: any[] = [];

  for (const o of owners) {
    try {
      const { data: userData, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: o.email,
          password,
          email_confirm: true,
          user_metadata: { username: o.username, display_name: o.username },
        });

      let userId = userData?.user?.id;

      if (createError) {
        // If user already exists, look it up by email.
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users?.find(
          (u) => u.email?.toLowerCase() === o.email.toLowerCase()
        );
        if (!existing) {
          results.push({ ...o, status: "error", error: createError.message });
          continue;
        }
        userId = existing.id;
      }

      if (!userId) {
        results.push({ ...o, status: "error", error: "no user id" });
        continue;
      }

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

      results.push({
        ...o,
        status: roleError ? "user_ok_role_failed" : "success",
        error: roleError?.message,
      });
    } catch (err) {
      results.push({ ...o, status: "error", error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});