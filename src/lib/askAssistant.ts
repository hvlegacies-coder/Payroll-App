import { supabase } from '@/integrations/supabase/client';

/**
 * Ask the in-app AI assistant (api/ai-assistant.ts). Sends the signed-in
 * user's token so admins get answers backed by live data lookups.
 */
export async function askAssistant(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ messages }),
  });
  // Errors after the response has started streaming arrive as { error } with status 200.
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    throw new Error(body?.error
      ? `${body.error}${body.detail ? `: ${String(body.detail).slice(0, 300)}` : ''}`
      : `Assistant error ${res.status}`);
  }
  return body?.reply || "Sorry, I couldn't get a response.";
}
