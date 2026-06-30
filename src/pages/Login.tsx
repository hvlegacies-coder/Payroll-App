import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Loader2, Building2, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import hvLogo from '@/assets/hv-logo.png';

type LoginMode = 'owner' | 'preparer';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>('owner');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // username (lowercased & normalized) -> { email, postLoginRoute }
  const ownerMap: Record<string, { email: string; route: string }> = {
    payroll:      { email: 'payroll@hvtaxprep.com',     route: '/' },
    michael:      { email: 'michael@hvtaxprep.com',     route: '/' },
    olbrown:      { email: 'olbrown@hvtaxprep.com',     route: '/' },
    julius:       { email: 'julius@hvtaxprep.com',      route: '/' },
    higherview:   { email: 'higherview@hvtaxprep.com',  route: '/offices/Higher View' },
    'higher view':{ email: 'higherview@hvtaxprep.com',  route: '/offices/Higher View' },
    'd&d':        { email: 'dd@hvtaxprep.com',          route: '/offices/D %26 D' },
    'd & d':      { email: 'dd@hvtaxprep.com',          route: '/offices/D %26 D' },
    powerplay:    { email: 'powerplay@hvtaxprep.com',   route: '/offices/PowerPlay' },
    's&c':        { email: 'sc@hvtaxprep.com',          route: '/offices/S %26 C' },
    's & c':      { email: 'sc@hvtaxprep.com',          route: '/offices/S %26 C' },
    'main event': { email: 'mainevent@hvtaxprep.com',   route: '/offices/Main Event' },
    mainevent:    { email: 'mainevent@hvtaxprep.com',   route: '/offices/Main Event' },
    kingj:        { email: 'kingj@hvtaxprep.com',       route: '/offices/King J' },
    'king j':     { email: 'kingj@hvtaxprep.com',       route: '/offices/King J' },
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      // Allow username OR an email directly
      const key = username.toLowerCase().trim();
      const mapped = ownerMap[key];
      const email = mapped?.email ?? (username.includes('@') ? username.trim() : '');
      const route = mapped?.route ?? '/';
      if (!email) { setError('Invalid username or password.'); setLoading(false); return; }

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError('Invalid username or password.'); setLoading(false); return; }

      // Keep legacy keys for any code still reading them
      localStorage.setItem('hvt_user', mapped ? username : email);
      localStorage.setItem('hvt_role', 'owner');
      navigate(route);
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="login-bg-gradient" />
      {/* Background logo watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src={hvLogo} alt="" className="w-[500px] h-[500px] object-contain opacity-[0.04]" />
      </div>
      <div className="login-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="login-particle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 6}s`, animationDuration: `${4 + Math.random() * 6}s` }} />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center mx-4 animate-[loginEntrance_0.6s_ease-out_both]">
        {/* Logo + Title */}
        <div className="flex items-center gap-3 mb-8">
          <img src={hvLogo} alt="Higher View Taxes" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-[hsl(43,85%,55%)]">Higher View Taxes</h1>
            <p className="text-sm text-[hsl(40,10%,50%)]">Payroll Platform</p>
          </div>
        </div>

        <div className="login-card relative w-full max-w-[440px] rounded-2xl overflow-hidden">
          <div className="p-8 sm:p-10 flex flex-col justify-center">
            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[hsl(43,85%,55%,0.3)] mb-8">
              <button
                type="button"
                onClick={() => { setMode('owner'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-300 ${mode === 'owner' ? 'bg-[hsl(43,85%,55%)] text-[hsl(40,10%,5%)]' : 'bg-transparent text-[hsl(40,10%,50%)] hover:text-[hsl(43,85%,55%)]'}`}
              >
                <Building2 className="w-4 h-4" />
                Owner Login
              </button>
              <button
                type="button"
                onClick={() => navigate('/preparer-login')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-300 bg-transparent text-[hsl(40,10%,50%)] hover:text-[hsl(43,85%,55%)]"
              >
                <UserCheck className="w-4 h-4" />
                Preparer Login
              </button>
            </div>

            <p className="text-sm text-[hsl(40,10%,50%)] mb-6">
              {mode === 'owner' ? 'Sign in as an office owner or admin' : 'Sign in as a tax preparer'}
            </p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[hsl(43,20%,60%)]">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(40,10%,35%)]" />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={mode === 'owner' ? 'Office name or admin username' : 'Preparer name or PTIN'} className="login-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[hsl(43,20%,60%)]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(40,10%,35%)]" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className="login-input w-full pl-10 pr-10 py-2.5 rounded-lg text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(40,10%,35%)] hover:text-[hsl(43,85%,55%)] transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-[hsl(0,72%,60%)] bg-[hsl(0,72%,50%,0.1)] border border-[hsl(0,72%,50%,0.2)] rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="login-btn-gold w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" className="text-xs text-[hsl(43,85%,55%)] hover:underline">Forgot Password?</button>
              <span className="mx-2 text-[hsl(40,10%,30%)]">·</span>
              <button type="button" onClick={() => navigate('/login/sub')} className="text-xs text-[hsl(43,85%,55%)] hover:underline">Sub-account login</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
