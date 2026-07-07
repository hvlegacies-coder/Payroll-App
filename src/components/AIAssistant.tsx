import { useState, useRef, useEffect } from 'react';
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply: string = data?.reply ?? "Sorry, I couldn't get a response. Please try again.";
      const updated: Message[] = [...newMessages, { role: 'assistant', content: reply }];
      setMessages(updated);

      if (ttsEnabled && reply) {
        window.speechSynthesis?.cancel();
        window.speechSynthesis?.speak(new SpeechSynthesisUtterance(reply));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to reach the AI service. Check your API key setup.');
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check the setup instructions and try again.',
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
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
      >
        <Bot className="h-5 w-5" />
      </button>

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
                <Bot className="h-4 w-4 text-primary" />
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            {messages.length === 0 && status !== 'thinking' && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6 text-primary" />
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
