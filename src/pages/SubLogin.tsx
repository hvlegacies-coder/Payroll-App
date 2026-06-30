import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, User, Loader2, Building2 } from "lucide-react";
import hvLogo from "@/assets/hv-logo.png";
import { supabase } from "@/integrations/supabase/client";

export default function SubLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);

    // Normalize inputs: strip whitespace + zero-width / non-breaking spaces,
    // and normalize smart quotes that mobile keyboards sometimes insert.
    const normalize = (s: string) =>
      s
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .trim();
    const normalizedUsername = normalize(username);
    const normalizedPassword = normalize(password);

    // Verify password server-side via edge function (no plaintext in client bundle).
    const { data: verify, error: verifyErr } = await supabase.functions.invoke(
      "verify-access-password",
      { body: { scope: "sub", password: normalizedPassword } },
    );
    if (verifyErr || !verify?.ok || !verify?.token) {
      setLoading(false);
      setError("Invalid username or password.");
      return;
    }

    // Look up the username among sub-account users (case-insensitive, tolerant of duplicates).
    const { data: links } = await (supabase as any)
      .from("account_users")
      .select("account_id,username")
      .ilike("username", normalizedUsername)
      .limit(1);
    const link = Array.isArray(links) ? links[0] : null;

    if (!link) {
      setLoading(false);
      setError("Invalid username or password.");
      return;
    }

    const { data: acct } = await (supabase as any)
      .from("accounts")
      .select("id,slug,name,parent_account_id")
      .eq("id", link.account_id)
      .maybeSingle();

    setLoading(false);
    if (!acct || !acct.parent_account_id) {
      setError("This account is not a sub-account.");
      return;
    }

    localStorage.setItem("hvt_user", link.username);
    localStorage.setItem("hvt_role", "sub");
    localStorage.setItem("hvt_sub_slug", acct.slug);
    localStorage.setItem("hvt_account_id", acct.id);
    localStorage.setItem("hvt_sub_token", verify.token);
    navigate(`/sub/${acct.slug}`, { replace: true });
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="login-bg-gradient" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src={hvLogo} alt="" className="w-[500px] h-[500px] object-contain opacity-[0.04]" />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center mx-4 animate-[loginEntrance_0.6s_ease-out_both]">
        <div className="flex items-center gap-3 mb-8">
          <img src={hvLogo} alt="Higher View Taxes" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-[hsl(43,85%,55%)]">Sub-account Login</h1>
            <p className="text-sm text-[hsl(40,10%,50%)]">For child office owners</p>
          </div>
        </div>

        <div className="login-card relative w-full max-w-[440px] rounded-2xl overflow-hidden">
          <div className="p-8 sm:p-10 flex flex-col justify-center">
            <div className="flex items-center justify-center gap-2 mb-6 text-[hsl(43,85%,55%)]">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">D&D · King J · Main Event · Powerplay · S&C</span>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[hsl(43,20%,60%)]">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(40,10%,35%)]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your sub-account username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    className="login-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[hsl(43,20%,60%)]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(40,10%,35%)]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="current-password"
                    className="login-input w-full pl-10 pr-10 py-2.5 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(40,10%,35%)] hover:text-[hsl(43,85%,55%)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-xs text-[hsl(0,72%,60%)] bg-[hsl(0,72%,50%,0.1)] border border-[hsl(0,72%,50%,0.2)] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="login-btn-gold w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-xs text-[hsl(43,85%,55%)] hover:underline"
              >
                ← Agency / Admin login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}