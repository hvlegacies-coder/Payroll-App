import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Loader2, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import hvLogo from '@/assets/hv-logo.png';

export default function PreparerLogin() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ptin, setPtin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setError(''); setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      navigate('/my-earnings');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !ptin) { setError('Please fill in all fields including PTIN.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      // 1. Create auth account first
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;

      // 2. Activate session so authenticated RLS policies apply
      if (authData.session) {
        await supabase.auth.setSession(authData.session);
      }

      // 3. Now check PTIN with authenticated session
      const normalizedPtin = ptin.trim().toUpperCase();
      const { data: preparerData } = await supabase
        .from('preparers')
        .select('contractor, ptin')
        .eq('ptin', normalizedPtin)
        .limit(1);

      if (!preparerData || preparerData.length === 0) {
        // Sign out and report — auth account exists but is unlinked
        await supabase.auth.signOut();
        setError('PTIN not found. Please check your PTIN and try again with a different email, or contact your administrator.');
        setLoading(false);
        return;
      }

      // 4. Link the auth user to the preparer record
      if (authData.user) {
        const { error: linkError } = await supabase.from('preparer_users').insert({
          user_id: authData.user.id,
          ptin: normalizedPtin,
          contractor_name: preparerData[0].contractor,
        });
        if (linkError) {
          console.error('preparer_users link error:', linkError);
          setError(`Linking failed: ${linkError.message}`);
          setLoading(false);
          return;
        }
      }
      setSuccess('Account created! You can now sign in.');
      setIsSignUp(false);
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="login-bg-gradient" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src={hvLogo} alt="" className="w-[500px] h-[500px] object-contain opacity-[0.04]" />
      </div>
      <div className="login-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="login-particle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 6}s`, animationDuration: `${4 + Math.random() * 6}s` }} />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center mx-4 animate-[loginEntrance_0.6s_ease-out_both]">
        <div className="flex items-center gap-3 mb-8">
          <img src={hvLogo} alt="Higher View Taxes" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-[hsl(43,85%,55%)]">Higher View Taxes</h1>
            <p className="text-sm text-[hsl(40,10%,50%)]">Preparer Portal</p>
          </div>
        </div>
        <div className="login-card relative w-full max-w-[440px] rounded-2xl overflow-hidden">
          <div className="p-8 sm:p-10 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-[hsl(43,85%,55%)]">
              <UserCheck className="w-5 h-5" />
              <h2 className="text-lg font-semibold">{isSignUp ? 'Create Account' : 'Preparer Sign In'}</h2>
            </div>
            <p className="text-sm text-[hsl(40,10%,50%)] mb-6">
              {isSignUp ? 'Register with your PTIN to view earnings' : 'View your weekly earnings and pay details'}
            </p>

            {success && <p className="text-xs text-[hsl(142,72%,37%)] bg-[hsl(142,72%,37%,0.1)] border border-[hsl(142,72%,37%,0.2)] rounded-lg px-3 py-2 mb-4">{success}</p>}

            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-5">
              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[hsl(43,20%,60%)]">PTIN</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(40,10%,35%)]" />
                    <input type="text" value={ptin} onChange={e => setPtin(e.target.value)} placeholder="P01234567" className="login-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[hsl(43,20%,60%)]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(40,10%,35%)]" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="login-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm" />
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
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }} className="text-xs text-[hsl(43,85%,55%)] hover:underline">
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Register with your PTIN"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
