import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Loader2, Building2, UserCheck } from 'lucide-react';
import kjLogo from '@/assets/kj-logo.png';
import { supabase } from '@/integrations/supabase/client';

type LoginMode = 'owner' | 'preparer';

export default function KingJLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>('owner');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    const normalize = (s: string) =>
      s
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .trim();
    const u = normalize(username).toLowerCase();
    const p = normalize(password);
    if (mode === 'owner') {
      const { data, error: vErr } = await supabase.functions.invoke('verify-access-password', {
        body: { scope: 'kingj', password: p },
      });
      setLoading(false);
      if (vErr || !data?.ok || !data?.token) {
        setError('Invalid username or password.');
        return;
      }
      if (u === 'king j' || u === 'kingj') {
        localStorage.setItem('hvt_user', 'King J');
        localStorage.setItem('hvt_role', 'owner');
        localStorage.setItem('hvt_kingj_token', data.token);
        navigate('/offices/King J');
        return;
      }
      setError('Invalid username or password.');
    } else {
      // Preparer mode is informational entry only; real auth happens via Supabase.
      setLoading(false);
      localStorage.setItem('hvt_user', normalize(username));
      localStorage.setItem('hvt_role', 'preparer');
      navigate('/');
    }
  };

  return (
    <div className="kj-login-page min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="kj-login-bg-gradient" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src={kjLogo} alt="" className="w-[500px] h-[500px] object-contain opacity-[0.06]" />
      </div>
      <div className="login-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="kj-login-particle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 6}s`, animationDuration: `${4 + Math.random() * 6}s` }} />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center mx-4 animate-[loginEntrance_0.6s_ease-out_both]">
        <div className="flex items-center gap-4 mb-8">
          <img src={kjLogo} alt="King J Income Tax Services" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-[hsl(45,80%,55%)]">King J</h1>
            <p className="text-sm text-[hsl(130,60%,45%)]">Income Tax Services</p>
          </div>
        </div>

        <div className="kj-login-card relative w-full max-w-[440px] rounded-2xl overflow-hidden">
          <div className="p-8 sm:p-10 flex flex-col justify-center">
            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[hsl(130,60%,40%,0.4)] mb-8">
              <button
                type="button"
                onClick={() => { setMode('owner'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-300 ${mode === 'owner' ? 'bg-gradient-to-r from-[hsl(45,80%,50%)] to-[hsl(130,60%,40%)] text-[hsl(0,0%,5%)]' : 'bg-transparent text-[hsl(45,30%,55%)] hover:text-[hsl(45,80%,55%)]'}`}
              >
                <Building2 className="w-4 h-4" />
                Owner Login
              </button>
              <button
                type="button"
                onClick={() => { setMode('preparer'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-300 ${mode === 'preparer' ? 'bg-gradient-to-r from-[hsl(45,80%,50%)] to-[hsl(130,60%,40%)] text-[hsl(0,0%,5%)]' : 'bg-transparent text-[hsl(45,30%,55%)] hover:text-[hsl(45,80%,55%)]'}`}
              >
                <UserCheck className="w-4 h-4" />
                Preparer Login
              </button>
            </div>

            <p className="text-sm text-[hsl(45,20%,50%)] mb-6">
              {mode === 'owner' ? 'Sign in as an office owner' : 'Sign in as a tax preparer'}
            </p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[hsl(130,30%,50%)]">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(130,20%,35%)]" />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={mode === 'owner' ? 'Office name or admin username' : 'Preparer name or PTIN'} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" className="kj-login-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[hsl(130,30%,50%)]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(130,20%,35%)]" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="current-password" className="kj-login-input w-full pl-10 pr-10 py-2.5 rounded-lg text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(130,20%,35%)] hover:text-[hsl(130,60%,45%)] transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-[hsl(0,72%,60%)] bg-[hsl(0,72%,50%,0.1)] border border-[hsl(0,72%,50%,0.2)] rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="kj-login-btn w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" className="text-xs text-[hsl(130,60%,45%)] hover:underline">Forgot Password?</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
