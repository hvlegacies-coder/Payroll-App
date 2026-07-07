import { useState, useRef, useEffect } from 'react';
import { Headset, Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SYSTEM_PROMPT = `You are a friendly, knowledgeable assistant for Higher View Taxes — a payroll platform for tax offices. You talk like a helpful colleague, not a manual. You never interrupt — you always wait for the person to finish their full thought before responding. You speak naturally and conversationally: short sentences, plain words, occasional contractions ("you'll", "it's", "don't"). You don't lecture or dump everything at once. If a question is vague, ask one short follow-up to clarify. If someone's just chatting, chat back. Answer the actual question asked — nothing more, nothing less.

APP PAGES: Dashboard (KPI overview), Upload Center (upload 5 weekly reports), Payroll Processing (view/process all rows by status), Preparers/Master PTIN (manage preparer records: PTIN, share%, office, EFIN), Office Summary (financial summary per office: fees, AGI, backend money, net pay), Verification Panel (flags issues: missing PTIN, zero share%, $0 fees, missing SSN — has auto-fix buttons), Email/Exports (send earnings emails), Data Dictionary (field definitions), System Logic (business rules).

FIVE WEEKLY REPORTS (uploaded in order): 1) Payroll Report — primary source, every return filed; 2) Backend Money Report — add-on fee revenue per office; 3) Advance Report — clients who took tax refund loans; 4) Client Data Report — client→preparer ownership; 5) Fee Intercept Report — fees intercepted from refunds.

KEY TERMS:
PTIN = Preparer Tax ID (e.g. P01234567) — links each payroll row to a preparer.
EFIN = 6-digit IRS office filing ID. EFINs: D&D=381268, PowerPlay=381623, S&C=385634, King J=741288.
Received Tax Prep Fees = what the client actually paid — starting point for all pay calculations.
After Advance = max(0, received_fees − (advance ? 100 : 0)) — $100 deducted if client took a loan.
Pay = after_advance × (share_percent / 100).
Share % = preparer's cut percentage (set per-preparer in Master PTIN).
Preparer Share = what the preparer takes home — differs by office (see below).
AGI = Total Received − Total Fees Due.
Net Pay = AGI + Backend Money.
Total Fees Due = High Prep Fee + Preparer Fee + Fee Intercept + Transmitter Fee.
Transmitter Fee credit = max(0, transmitter_fee − 10) per row (office keeps amount above $10).
Backend Money = add-on fee revenue from Backend Money Report, added to AGI.
Fee Intercept = fees auto-deducted from client refunds by the bank.

PREPARER SHARE BY OFFICE:
Higher View: if client belongs to preparer → share = min(received × preparer_client_percent%, after_advance); else → share = min(office_flat_rate, after_advance).
King J: share = after_advance × kingj_preparer_share%.
All others (D&D, PowerPlay, S&C, etc.): share = pay.

ROW STATUS FLOW: imported → mapped → calculated → advance_applied → distributed → sent → archived. Error states: no_match (duplicate PTIN, EFIN mismatch), ptin_not_found (PTIN not in table), missing_office (no tax office set).

CONSTANTS: Advance fee = $100. Transmitter threshold = $10. Higher View preparer fee = $25/preparer/run. D&D special: Tax Champions rows auto-fold into D&D totals. Email batch = 10 msgs, 200ms delay. Transactional email TTL = 60min. Auth email TTL = 15min.

OFFICES: Higher View, D&D, PowerPlay, S&C, King J, Main Event, Tax Champions, Bright Meadow, Malone Method, Premier Tax Software, Prolific Legacy, Clarity Tax Group, S&D Tax Solutions, R'Moni, Savvy Tax Pros, SmartFile, Stellar Tax Co, Tygermatic Taxes, Pink Connection, Big Payback, Go Up Financials.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Status = 'idle' | 'listening' | 'thinking';

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-assistant', handler);
    return () => window.removeEventListener('open-ai-assistant', handler);
  }, []);

  function handleClose() {
    stopListening();
    window.speechSynthesis?.cancel();
    setOpen(false);
  }

  function stopListening() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setStatus('idle');
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input is not supported in this browser. Use the text field instead.');
      return;
    }
    setError(null);
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'en-US';
    r.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      sendMessage(transcript);
    };
    r.onerror = () => {
      setStatus('idle');
      recognitionRef.current = null;
    };
    r.onend = () => {
      if (status === 'listening') setStatus('idle');
      recognitionRef.current = null;
    };
    r.start();
    recognitionRef.current = r;
    setStatus('listening');
  }

  function toggleMic() {
    if (status === 'listening') {
      stopListening();
    } else if (status === 'idle') {
      startListening();
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status === 'thinking') return;

    stopListening();
    setError(null);

    const newMessages: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(newMessages);
    setInput('');
    setStatus('thinking');

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) throw new Error('VITE_GROQ_API_KEY not set in Vercel environment variables');

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newMessages,
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 300)}`);
      }
      const data = await res.json();
      const reply: string = data?.choices?.[0]?.message?.content ?? "Sorry, I couldn't get a response.";
      const updated: Message[] = [...newMessages, { role: 'assistant', content: reply }];
      setMessages(updated);

      if (ttsEnabled && reply) {
        window.speechSynthesis?.cancel();
        window.speechSynthesis?.speak(new SpeechSynthesisUtterance(reply));
      }
    } catch (err: any) {
      const detail = err?.message || 'Unknown error';
      setError(detail);
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Error: ${detail}`,
      }]);
    } finally {
      setStatus('idle');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <SheetContent
          side="right"
          className="w-full sm:w-[400px] p-0 flex flex-col gap-0"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Headset className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">AI Assistant</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ask about app logic</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTtsEnabled(v => !v)}
                aria-label={ttsEnabled ? 'Disable voice output' : 'Enable voice output'}
                title={ttsEnabled ? 'Voice output on' : 'Voice output off'}
              >
                {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            {messages.length === 0 && status !== 'thinking' && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Headset className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium mb-1">Ask me anything</p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  I know everything about how this app works — formulas, fields, offices, and more.
                </p>
                <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[280px]">
                  {[
                    'How is pay calculated?',
                    'What does After Advance mean?',
                    'How does Higher View share work?',
                    'What is the transmitter fee rule?',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {status === 'thinking' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-1 text-[10px] text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Status bar */}
          {status === 'listening' && (
            <div className="mx-4 mb-1 flex items-center gap-2 text-[10px] text-primary bg-primary/10 px-3 py-2 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Listening… speak your question
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-border px-3 py-2.5 flex items-center gap-2 shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              className="flex-1 h-9 text-sm"
              disabled={status === 'thinking'}
            />
            <Button
              variant={status === 'listening' ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={toggleMic}
              disabled={status === 'thinking'}
              aria-label={status === 'listening' ? 'Stop listening' : 'Start voice input'}
              title="Voice input"
            >
              {status === 'listening' ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || status !== 'idle'}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
