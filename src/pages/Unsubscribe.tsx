import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, MailX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(d => {
        if (d.valid === false && d.reason === 'already_unsubscribed') setStatus('already');
        else if (d.valid) setStatus('valid');
        else setStatus('invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleConfirm = async () => {
    setStatus('loading');
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
      if (error) throw error;
      if (data?.success) setStatus('success');
      else if (data?.reason === 'already_unsubscribed') setStatus('already');
      else setStatus('error');
    } catch { setStatus('error'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-xl border p-8 text-center space-y-4">
        {status === 'loading' && <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />}
        {status === 'valid' && (
          <>
            <MailX className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">Unsubscribe</h1>
            <p className="text-muted-foreground text-sm">You will no longer receive emails from Higher View Tax Services.</p>
            <Button onClick={handleConfirm} variant="destructive">Confirm Unsubscribe</Button>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <h1 className="text-xl font-bold">Unsubscribed</h1>
            <p className="text-muted-foreground text-sm">You have been successfully unsubscribed.</p>
          </>
        )}
        {status === 'already' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-bold">Already Unsubscribed</h1>
            <p className="text-muted-foreground text-sm">This email has already been unsubscribed.</p>
          </>
        )}
        {(status === 'invalid' || status === 'error') && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">{status === 'invalid' ? 'Invalid Link' : 'Error'}</h1>
            <p className="text-muted-foreground text-sm">{status === 'invalid' ? 'This unsubscribe link is invalid or has expired.' : 'Something went wrong. Please try again.'}</p>
          </>
        )}
      </div>
    </div>
  );
}
