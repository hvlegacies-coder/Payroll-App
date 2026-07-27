import { useState, useRef, useEffect } from 'react';
import { Headset, Lock, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Status = 'idle' | 'listening' | 'thinking';

const AI_ASSISTANT_PASSWORD = 'HV Legacies';
const UNLOCK_SESSION_KEY = 'hv_ai_assistant_unlocked';
// How long to wait after the user stops speaking before treating them as
// "done" and submitting. Longer than the browser's own (opaque, ~1.5-2s)
// endpointer so a mid-thought pause doesn't cut them off early.
const SILENCE_TIMEOUT_MS = 2800;

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_SESSION_KEY) === 'true');
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-assistant', handler);
    return () => window.removeEventListener('open-ai-assistant', handler);
  }, []);

  function handleClose() {
    clearSilenceTimer();
    stopListening();
    window.speechSynthesis?.cancel();
    setOpen(false);
    setPwInput('');
    setPwError('');
  }

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (pwInput === AI_ASSISTANT_PASSWORD) {
      setUnlocked(true);
      sessionStorage.setItem(UNLOCK_SESSION_KEY, 'true');
      setPwInput('');
      setPwError('');
    } else {
      setPwError('Incorrect password.');
    }
  }

  function stopListening() {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    transcriptRef.current = '';
    setLiveTranscript('');
    setStatus('idle');
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input is not supported in this browser. Use the text field instead.');
      return;
    }
    setError(null);
    transcriptRef.current = '';
    setLiveTranscript('');
    const r = new SR();
    // Keep the mic open and stream interim results — the browser's own
    // built-in silence detection (used when continuous=false) cuts users
    // off too early. We drive end-of-speech ourselves via SILENCE_TIMEOUT_MS.
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (e: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) transcriptRef.current = `${transcriptRef.current} ${finalText}`.trim();
      setLiveTranscript(`${transcriptRef.current} ${interimText}`.trim());

      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        const text = transcriptRef.current.trim();
        stopListening();
        if (text) sendMessage(text);
      }, SILENCE_TIMEOUT_MS);
    };
    r.onerror = () => {
      if (recognitionRef.current !== r) return;
      clearSilenceTimer();
      recognitionRef.current = null;
      transcriptRef.current = '';
      setLiveTranscript('');
      setStatus('idle');
    };
    r.onend = () => {
      // Continuous sessions can end on their own (network hiccup, browser
      // session cap). Only act if this instance is still the active one —
      // if stopListening() already ran, it nulled recognitionRef and this
      // is an expected, stale onend to ignore (avoids a double-submit).
      if (recognitionRef.current !== r) return;
      recognitionRef.current = null;
      clearSilenceTimer();
      const text = transcriptRef.current.trim();
      transcriptRef.current = '';
      setLiveTranscript('');
      if (text) sendMessage(text);
      else setStatus('idle');
    };
    r.start();
    recognitionRef.current = r;
    setStatus('listening');
  }

  function toggleMic() {
    if (status === 'listening') {
      // Explicit "I'm done talking" — submit whatever's been captured so
      // far instead of making the user wait out the silence timer.
      const text = transcriptRef.current.trim();
      stopListening();
      if (text) sendMessage(text);
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
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ? `${data.error}${data.detail ? `: ${String(data.detail).slice(0, 300)}` : ''}` : `Assistant error ${res.status}`);
      }
      const reply: string = data?.reply || "Sorry, I couldn't get a response.";
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
          className="w-full sm:w-[400px] p-0 flex flex-col gap-0 [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Headset className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">HV Assistant</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {unlocked ? 'Say "Hey HV" to get started' : 'Password required to continue'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unlocked && (
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
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!unlocked && (
            <form onSubmit={handleUnlock} className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">This assistant is password-protected</p>
              <p className="text-xs text-muted-foreground max-w-[240px]">Enter the password to start chatting with HV Assistant.</p>
              <div className="w-full max-w-[260px] space-y-2 mt-1">
                <Input
                  type="password"
                  value={pwInput}
                  onChange={e => { setPwInput(e.target.value); setPwError(''); }}
                  placeholder="Password"
                  className="text-sm text-center"
                  autoFocus
                />
                {pwError && <p className="text-[11px] text-destructive">{pwError}</p>}
                <Button type="submit" className="w-full gap-1.5" disabled={!pwInput.trim()}>
                  <Lock className="h-3.5 w-3.5" /> Unlock
                </Button>
              </div>
            </form>
          )}

          {unlocked && (
          <>
          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            {messages.length === 0 && status !== 'thinking' && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Headset className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium mb-1">Ask me anything</p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Hey! I'm HV — ask me anything about how this app works.
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
            <div className="mx-4 mb-1 flex items-start gap-2 text-[10px] text-primary bg-primary/10 px-3 py-2 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mt-0.5 shrink-0" />
              <span>
                {liveTranscript || 'Listening… speak your question'}
                <span className="block text-primary/60 mt-0.5">Pause when you're done, or tap the mic to send now.</span>
              </span>
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
          </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
