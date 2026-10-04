"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { AiStrategyRequest } from "@/components/lab/types";

type Provider = "openai" | "gemini";
type Message = { role: "user" | "assistant"; content: string };
const providers = {
  openai: { name: "ChatGPT", model: "gpt-6-astra", keyUrl: "https://platform.openai.com/api-keys" },
  gemini: { name: "Gemini", model: "gemini-3.8-flash", keyUrl: "https://aistudio.google.com/apikey" },
};
const suggestions = ["Explain mycurrent strategy", "What happens if volatility drops?", "Create a bullish spread for me"];
const control = "rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";

function Sparkles({ className = "size-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" /><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z" /></svg>;
}

export default function AiHelp({ context, onCreateStrategy }: {
  context: string;
  // Returns a short outcome message that is shown in the chat.
  onCreateStrategy: (request: AiStrategyRequest) => string;
}) {
  const createStrategy = useRef(onCreateStrategy);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [drawerHost, setDrawerHost] = useState<HTMLElement | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const [provider, setProvider] = useState<Provider>("openai");
  const [connections, setConnections] = useState({
    openai: { apiKey: "", model: providers.openai.model },
    gemini: { apiKey: "", model: providers.gemini.model },
  });
  const [histories, setHistories] = useState<Record<Provider, Message[]>>({ openai: [], gemini: [] });
  const [showConnections, setShowConnections] = useState(true);
  const [includeContext, setIncludeContext] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const messages = histories[provider];
  const connection = connections[provider];
  // Gemini uses the server's GEMINI_API_KEY, so only ChatGPT needs a key here.
  const needsKey = provider === "openai";
  const hasKey = !needsKey || Boolean(connection.apiKey.trim());

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy, error]);
  useEffect(() => () => request.current?.abort(), []);
  // The reply arrives after an await, so always call the latest handler.
  useEffect(() => { createStrategy.current = onCreateStrategy; });
  useEffect(() => {
    if (!drawerHost) return;
    const panel = dialog.current;
    panel?.show();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && panel?.open) {
        event.preventDefault();
        panel.close();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [drawerHost]);

  async function send(question = draft) {
    if (request.current || !question.trim()) return;
    if (!hasKey) {
      setShowConnections(true);
      setError(`Add your ${providers[provider].name} API key to start chatting.`);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    const next: Message[] = [...messages, { role: "user", content: question.trim() }];
    setHistories((current) => ({ ...current, [provider]: next }));
    setDraft("");
    try {
      const response = await fetch("/api/ai-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, ...(needsKey ? { apiKey: connection.apiKey.trim() } : {}), model: connection.model.trim(),
          messages: next.slice(-9).map((message) => ({ ...message, content: message.content.slice(0, 8000) })),
          ...(includeContext ? { context } : {}),
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Could not get an answer. Please try again.");
      const content = [data.reply, data.strategy ? createStrategy.current(data.strategy) : ""].filter(Boolean).join("\n\n");
      setHistories((current) => ({ ...current, [provider]: [...next, { role: "assistant", content }] }));
    } catch (cause) {
      setHistories((current) => ({ ...current, [provider]: messages }));
      setDraft(question);
      setError(controller.signal.aborted ? "Response stopped. Your question is ready to resend."
        : cause instanceof Error ? cause.message : "Could not connect. Please try again.");
    } finally {
      request.current = null;
      setBusy(false);
    }
  }

  return (
    <>
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={Boolean(drawerHost)} aria-controls="ai-help-drawer"
        onClick={(event) => setDrawerHost(event.currentTarget.closest("main") ?? document.body)}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-center rounded-full border border-accent-border bg-accent-faint px-3 py-2 text-xs font-semibold text-accent-strong shadow-sm transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4 sm:text-sm">
        <Sparkles /> Ask AI for help
      </button>
      {drawerHost && createPortal(<dialog ref={dialog} id="ai-help-drawer" aria-labelledby="ai-help-title"
        onClose={() => { request.current?.abort(); setDrawerHost(null); trigger.current?.focus({ preventScroll: true }); }}
        className="fixed inset-y-0 left-auto right-0 z-[60] m-0 h-dvh max-h-dvh w-full max-w-md border-0 border-l border-line bg-surface p-0 text-slate-900 shadow-2xl">
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent"><Sparkles className="size-6" /></span>
            <div className="flex-1"><h2 id="ai-help-title" className="text-lg font-semibold">Ask AI for help</h2><p className="text-xs text-ink-muted">A little clarity for your next scenario.</p></div>
            <button type="button" aria-label="Close AI help" className={cn(control, "border-transparent text-xl")}
              onClick={() => dialog.current?.close()}>×</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 rounded-full bg-surface-sunken p-1" aria-label="AI provider">
                {(Object.keys(providers) as Provider[]).map((id) => (
                  <button key={id} type="button" disabled={busy} aria-pressed={provider === id}
                    onClick={() => { setProvider(id); setError(""); setShowConnections(id === "openai" && !connections[id].apiKey); }}
                    className={cn("flex-1 rounded-full px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50", provider === id ? "bg-surface text-slate-900 shadow-sm" : "text-ink-muted")}>
                    {providers[id].name}
                  </button>
                ))}
              </div>
              <button type="button" aria-expanded={showConnections} onClick={() => setShowConnections(!showConnections)} className="text-xs font-semibold text-accent underline-offset-4 hover:underline">Connections</button>
            </div>
            {showConnections && (
              <div className="mt-4 space-y-3 rounded-2xl border border-line bg-surface-muted p-4">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{providers[provider].name} connection</h3>
                  {needsKey && <a href={providers[provider].keyUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent hover:underline">Get API key ↗</a>}</div>
                {needsKey && <label className="block text-xs font-medium text-ink-secondary">API key
                  <input type="password" autoComplete="off" spellCheck={false} disabled={busy} value={connection.apiKey}
                    placeholder={provider === "openai" ? "sk-…" : "Paste your Gemini API key"}
                    onChange={(event) => setConnections((current) => ({ ...current, [provider]: { ...current[provider], apiKey: event.target.value } }))}
                    className={cn(control, "mt-1 w-full")} />
                </label>}
                <label className="block text-xs font-medium text-ink-secondary">Model
                  <input value={connection.model} disabled={busy} spellCheck={false} maxLength={100}
                    onChange={(event) => setConnections((current) => ({ ...current, [provider]: { ...current[provider], model: event.target.value } }))}
                    className={cn(control, "mt-1 w-full font-mono text-xs")} />
                </label>
                <p className="text-caption leading-relaxed text-ink-muted">{needsKey
                  ? "Your key stays in memory until you reload this page. Requests pass through Callculator to your selected provider. API usage is billed by that provider."
                  : "Gemini uses Callculator's own API key, so there is nothing to add. Requests pass through Callculator to Gemini."}</p>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" disabled={busy || !hasKey} className={cn("text-xs text-ink-muted underline disabled:opacity-40", !needsKey && "invisible")}
                    onClick={() => { setConnections((current) => ({ ...current, [provider]: { ...current[provider], apiKey: "" } })); setError(""); }}>Remove key</button>
                  <button type="button" disabled={!hasKey || busy || !connection.model.trim()} onClick={() => { setShowConnections(false); setError(""); }} className={cn(control, "bg-accent font-semibold text-white")}>Use {providers[provider].name}</button>
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-5">
            {messages.length === 0 && (
              <div className="space-y-4 py-3">
                <div><p className="text-lg font-semibold">Make sense of your strategy.</p><p className="mt-2 text-sm leading-relaxed text-ink-muted">Explore the numbers, understand the trade-offs, or ask where to start.</p></div>
                <div className="space-y-2">{suggestions.map((question) => <button key={question} type="button" onClick={() => setDraft(question)} className={cn(control, "flex w-full items-center justify-between gap-3 text-left text-ink-secondary hover:border-accent-border hover:bg-accent-faint")}><span>{question}</span><span aria-hidden="true">↗</span></button>)}</div>
              </div>
            )}
            <div role="log" aria-label={`${providers[provider].name} conversation`} aria-live="polite" className="space-y-4">
              {messages.map((message, index) => <div key={index} className={cn("rounded-2xl px-4 py-3", message.role === "user" ? "ml-6 bg-accent-soft" : "mr-2 bg-surface-muted")}>
                <p className="mb-1 text-micro font-semibold uppercase tracking-wider text-ink-muted">{message.role === "user" ? "You" : providers[provider].name}</p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
              </div>)}
            </div>
            {busy && <p role="status" className="mt-4 text-sm text-ink-muted motion-safe:animate-pulse">{providers[provider].name} is thinking…</p>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-loss">{error}</p>}
            <div ref={end} />
          </div>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="shrink-0 space-y-3 border-t border-slate-100 bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeContext} disabled={busy} onChange={(event) => setIncludeContext(event.target.checked)} className="accent-accent" /> Include current strategy</label>
              <button type="button" disabled={busy || !messages.length} onClick={() => { setHistories((current) => ({ ...current, [provider]: [] })); setError(""); }} className="hover:text-slate-900 disabled:opacity-40">New chat</button>
            </div>
            <div className="rounded-2xl border border-line p-2 focus-within:border-accent-border focus-within:ring-2 focus-within:ring-accent-ring">
              <label htmlFor="ai-question" className="sr-only">Your question</label>
              <textarea id="ai-question" value={draft} disabled={busy} maxLength={4000} rows={2} placeholder="Ask about your strategy…"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
                className="max-h-32 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400 disabled:opacity-50" />
              <div className="flex items-center justify-between px-1"><span className="text-micro text-slate-400">{hasKey ? providers[provider].name : "Add an API key in Connections"}</span>
                {busy ? <button type="button" onClick={() => request.current?.abort()} className={control}>Stop</button>
                  : <button type="submit" disabled={!draft.trim()} className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40">Send ↑</button>}
              </div>
            </div>
            <p className="text-center text-micro text-slate-400">AI can make mistakes. For education, not financial advice.</p>
          </form>
        </div>
      </dialog>, drawerHost)}
    </>
  );
}
