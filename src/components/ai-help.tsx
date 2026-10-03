"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type Provider = "openai" | "gemini";
type Message = { role: "user" | "assistant"; content: string };
const providers = {
  openai: { name: "ChatGPT", model: "gpt-6-astra", keyUrl: "https://platform.openai.com/api-keys" },
  gemini: { name: "Gemini", model: "gemini-3.8-flash", keyUrl: "https://aistudio.google.com/apikey" },
};
const suggestions = ["Explain my current strategy", "What happens if volatility drops?", "Help me understand my risk"];
const control = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50";

function Sparkles({ className = "size-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" /><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z" /></svg>;
}

export default function AiHelp({ context }: { context: string }) {
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
  const hasKey = Boolean(connection.apiKey.trim());

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy, error]);
  useEffect(() => () => request.current?.abort(), []);
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
          provider, apiKey: connection.apiKey.trim(), model: connection.model.trim(),
          messages: next.slice(-9).map((message) => ({ ...message, content: message.content.slice(0, 8000) })),
          ...(includeContext ? { context } : {}),
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Could not get an answer. Please try again.");
      setHistories((current) => ({ ...current, [provider]: [...next, { role: "assistant", content: data.reply }] }));
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
        className="inline-flex shrink-0 items-center justify-center gap-2 self-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-faint)] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)] shadow-sm transition hover:bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:px-4 sm:text-sm">
        <Sparkles /> Ask AI for help
      </button>
      {drawerHost && createPortal(<dialog ref={dialog} id="ai-help-drawer" aria-labelledby="ai-help-title"
        onClose={() => { request.current?.abort(); setDrawerHost(null); trigger.current?.focus({ preventScroll: true }); }}
        className="fixed inset-y-0 left-auto right-0 z-[60] m-0 h-dvh max-h-dvh w-full max-w-md border-0 border-l border-slate-200 bg-white p-0 text-slate-900 shadow-2xl">
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Sparkles className="size-6" /></span>
            <div className="flex-1"><h2 id="ai-help-title" className="text-lg font-semibold">Ask AI for help</h2><p className="text-xs text-slate-500">A little clarity for your next scenario.</p></div>
            <button type="button" aria-label="Close AI help" className={cn(control, "border-transparent text-xl")}
              onClick={() => dialog.current?.close()}>×</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 rounded-full bg-slate-100 p-1" aria-label="AI provider">
                {(Object.keys(providers) as Provider[]).map((id) => (
                  <button key={id} type="button" disabled={busy} aria-pressed={provider === id}
                    onClick={() => { setProvider(id); setError(""); setShowConnections(!connections[id].apiKey); }}
                    className={cn("flex-1 rounded-full px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50", provider === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                    {providers[id].name}
                  </button>
                ))}
              </div>
              <button type="button" aria-expanded={showConnections} onClick={() => setShowConnections(!showConnections)} className="text-xs font-semibold text-[var(--accent)] underline-offset-4 hover:underline">Connections</button>
            </div>
            {showConnections && (
              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{providers[provider].name} connection</h3>
                  <a href={providers[provider].keyUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--accent)] hover:underline">Get API key ↗</a></div>
                <label className="block text-xs font-medium text-slate-600">API key
                  <input type="password" autoComplete="off" spellCheck={false} disabled={busy} value={connection.apiKey}
                    placeholder={provider === "openai" ? "sk-…" : "Paste your Gemini API key"}
                    onChange={(event) => setConnections((current) => ({ ...current, [provider]: { ...current[provider], apiKey: event.target.value } }))}
                    className={cn(control, "mt-1 w-full")} />
                </label>
                <label className="block text-xs font-medium text-slate-600">Model
                  <input value={connection.model} disabled={busy} spellCheck={false} maxLength={100}
                    onChange={(event) => setConnections((current) => ({ ...current, [provider]: { ...current[provider], model: event.target.value } }))}
                    className={cn(control, "mt-1 w-full font-mono text-xs")} />
                </label>
                <p className="text-[11px] leading-relaxed text-slate-500">Your key stays in memory until you reload this page. Requests pass through Callculator to your selected provider. API usage is billed by that provider.</p>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" disabled={busy || !hasKey} className="text-xs text-slate-500 underline disabled:opacity-40"
                    onClick={() => { setConnections((current) => ({ ...current, [provider]: { ...current[provider], apiKey: "" } })); setError(""); }}>Remove key</button>
                  <button type="button" disabled={!hasKey || busy || !connection.model.trim()} onClick={() => { setShowConnections(false); setError(""); }} className={cn(control, "bg-[var(--accent)] font-semibold text-white")}>Use {providers[provider].name}</button>
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-5">
            {messages.length === 0 && (
              <div className="space-y-4 py-3">
                <div><p className="text-lg font-semibold">Make sense of your strategy.</p><p className="mt-2 text-sm leading-relaxed text-slate-500">Explore the numbers, understand the trade-offs, or ask where to start.</p></div>
                <div className="space-y-2">{suggestions.map((question) => <button key={question} type="button" onClick={() => setDraft(question)} className={cn(control, "flex w-full items-center justify-between gap-3 text-left text-slate-600 hover:border-[var(--accent-border)] hover:bg-[var(--accent-faint)]")}><span>{question}</span><span aria-hidden="true">↗</span></button>)}</div>
              </div>
            )}
            <div role="log" aria-label={`${providers[provider].name} conversation`} aria-live="polite" className="space-y-4">
              {messages.map((message, index) => <div key={index} className={cn("rounded-2xl px-4 py-3", message.role === "user" ? "ml-6 bg-[var(--accent-soft)]" : "mr-2 bg-slate-50")}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{message.role === "user" ? "You" : providers[provider].name}</p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
              </div>)}
            </div>
            {busy && <p role="status" className="mt-4 text-sm text-slate-500 motion-safe:animate-pulse">{providers[provider].name} is thinking…</p>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div ref={end} />
          </div>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="shrink-0 space-y-3 border-t border-slate-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <label className="flex items-center gap-2"><input type="checkbox" checked={includeContext} disabled={busy} onChange={(event) => setIncludeContext(event.target.checked)} className="accent-[var(--accent)]" /> Include current strategy</label>
              <button type="button" disabled={busy || !messages.length} onClick={() => { setHistories((current) => ({ ...current, [provider]: [] })); setError(""); }} className="hover:text-slate-900 disabled:opacity-40">New chat</button>
            </div>
            <div className="rounded-2xl border border-slate-200 p-2 focus-within:border-[var(--accent-border)] focus-within:ring-2 focus-within:ring-[var(--accent-ring)]">
              <label htmlFor="ai-question" className="sr-only">Your question</label>
              <textarea id="ai-question" value={draft} disabled={busy} maxLength={4000} rows={2} placeholder="Ask about your strategy…"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
                className="max-h-32 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400 disabled:opacity-50" />
              <div className="flex items-center justify-between px-1"><span className="text-[10px] text-slate-400">{hasKey ? providers[provider].name : "Add an API key in Connections"}</span>
                {busy ? <button type="button" onClick={() => request.current?.abort()} className={control}>Stop</button>
                  : <button type="submit" disabled={!draft.trim()} className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40">Send ↑</button>}
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400">AI can make mistakes. For education, not financial advice.</p>
          </form>
        </div>
      </dialog>, drawerHost)}
    </>
  );
}
