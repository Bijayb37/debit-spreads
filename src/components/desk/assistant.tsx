"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import { cn } from "@/lib/cn";
import { cleanDesk, type Desk } from "@/lib/scenario-desk";

type Provider = "gemini" | "openai";
type Message = { role: "user" | "assistant"; content: string; activity?: string[] };

export type AssistantHandle = { ask: (prompt: string) => void };

const providers = {
  gemini: { name: "Gemini", model: "gemini-3.8-flash" },
  openai: { name: "ChatGPT", model: "gpt-6-astra" },
};
const input =
  "w-full rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-50";

export function Assistant({
  desk,
  todayIso,
  onDesk,
  onClose,
  ref,
}: {
  desk: Desk;
  todayIso: string;
  // Receives the desk after the assistant's changes.
  onDesk: (desk: Desk, summary: string) => void;
  onClose: () => void;
  ref?: Ref<AssistantHandle>;
}) {
  const [provider, setProvider] = useState<Provider>("gemini");
  const [connections, setConnections] = useState({
    gemini: { apiKey: "", model: providers.gemini.model },
    openai: { apiKey: "", model: providers.openai.model },
  });
  const [histories, setHistories] = useState<Record<Provider, Message[]>>({ gemini: [], openai: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const latestDesk = useRef(desk);
  const messages = histories[provider];
  const connection = connections[provider];
  const needsKey = provider === "openai";

  useEffect(() => { latestDesk.current = desk; });
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy, error]);
  useEffect(() => () => request.current?.abort(), []);
  useImperativeHandle(ref, () => ({
    ask(prompt) {
      setDraft(prompt);
      box.current?.focus();
    },
  }), []);

  async function send(question = draft) {
    if (request.current || !question.trim()) return;
    if (needsKey && !connection.apiKey.trim()) {
      setShowSettings(true);
      setError("Add your OpenAI API key to use ChatGPT.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const sentDesk = latestDesk.current;
    const next: Message[] = [...messages, { role: "user", content: question.trim() }];
    setBusy(true);
    setError("");
    setDraft("");
    setHistories((current) => ({ ...current, [provider]: next }));
    try {
      const response = await fetch("/api/desk-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, model: connection.model.trim(), todayIso, desk: sentDesk,
          ...(needsKey ? { apiKey: connection.apiKey.trim() } : {}),
          messages: next.slice(-9).map((message) => ({ role: message.role, content: message.content.slice(0, 8000) })),
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Could not get an answer. Please try again.");
      const activity: string[] = Array.isArray(data.activity) ? data.activity.filter((item: unknown) => typeof item === "string") : [];
      if (data.desk) {
        // The assistant edited a copy of the desk as it was sent; don't overwrite newer edits.
        if (latestDesk.current !== sentDesk) throw new Error("You changed the page while the assistant was working, so its changes were not applied. Send the request again.");
        onDesk(cleanDesk(data.desk), activity.join(" · "));
      }
      setHistories((current) => ({ ...current, [provider]: [...next, { role: "assistant", content: data.reply, activity }] }));
    } catch (cause) {
      setHistories((current) => ({ ...current, [provider]: messages }));
      setDraft(question);
      setError(controller.signal.aborted ? "Stopped. Nothing was changed." : cause instanceof Error ? cause.message : "Could not connect. Please try again.");
    } finally {
      request.current = null;
      setBusy(false);
    }
  }

  const suggestions = [
    `What happens to my position if ${desk.market.symbol} rallies 15% in three weeks and then gives it back by day 45?`,
    "Why is the same stock price worth less to me later on?",
    desk.strategies.length > 1 ? "Which of these holds up best if the stock goes nowhere?" : "Add a cheaper alternative to compare with this",
  ];

  return (
    <aside aria-label="Assistant" className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">Assistant</h2>
          <p className="truncate text-xs text-ink-muted">Sets things up and explains the numbers</p>
        </div>
        <button type="button" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)} className="text-xs font-semibold text-accent underline-offset-2 hover:underline">
          {providers[provider].name}
        </button>
        <button type="button" aria-label="Close assistant" onClick={onClose} className="grid size-8 place-items-center rounded-md text-xl text-ink-secondary hover:bg-surface-sunken">
          ×
        </button>
      </header>
      {showSettings ? (
        <div className="space-y-2 border-b border-line bg-surface-muted px-4 py-3">
          <div className="flex rounded-md bg-surface-sunken p-0.5" aria-label="AI provider">
            {(Object.keys(providers) as Provider[]).map((id) => (
              <button key={id} type="button" disabled={busy} aria-pressed={provider === id} onClick={() => { setProvider(id); setError(""); }}
                className={cn("flex-1 rounded px-2 py-1 text-xs font-semibold", provider === id ? "bg-surface text-ink shadow-sm" : "text-ink-secondary")}>
                {providers[id].name}
              </button>
            ))}
          </div>
          {needsKey ? (
            <label className="block text-xs font-medium text-ink-secondary">
              OpenAI API key
              <input id="assistant-key" type="password" autoComplete="off" spellCheck={false} disabled={busy} value={connection.apiKey} placeholder="sk-…"
                onChange={(event) => setConnections((current) => ({ ...current, openai: { ...current.openai, apiKey: event.target.value } }))} className={cn(input, "mt-1")} />
            </label>
          ) : null}
          <label className="block text-xs font-medium text-ink-secondary">
            Model
            <input id="assistant-model" value={connection.model} disabled={busy} spellCheck={false} maxLength={100}
              onChange={(event) => setConnections((current) => ({ ...current, [provider]: { ...current[provider], model: event.target.value } }))} className={cn(input, "mt-1 font-mono text-xs")} />
          </label>
          <p className="text-caption leading-relaxed text-ink-muted">
            {needsKey ? "Your key stays in memory until you reload and is sent only to OpenAI through this app." : "Gemini uses this app's own key."} Your setup is sent with each message.
          </p>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-secondary">Ask in plain words. Changes show up on the page straight away and can be undone.</p>
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => { setDraft(suggestion); box.current?.focus(); }}
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink-soft hover:border-accent-border hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-accent">
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={cn("rounded-xl px-3 py-2", message.role === "user" ? "ml-6 bg-accent-soft" : "mr-2 bg-surface-muted")}>
              <p className="mb-0.5 text-micro font-semibold uppercase tracking-wider text-ink-muted">{message.role === "user" ? "You" : providers[provider].name}</p>
              {message.activity?.length ? (
                <ul className="mb-1.5 space-y-0.5">
                  {message.activity.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-xs font-medium text-gain">✓ {item}</li>
                  ))}
                </ul>
              ) : null}
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{message.content}</p>
            </div>
          ))}
        </div>
        {busy ? <p role="status" className="mt-3 text-sm text-ink-muted motion-safe:animate-pulse">Working on it…</p> : null}
        {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-loss">{error}</p> : null}
        <div ref={end} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="space-y-1.5 border-t border-line px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <label htmlFor="assistant-question" className="sr-only">Message the assistant</label>
        <textarea ref={box} id="assistant-question" value={draft} disabled={busy} maxLength={4000} rows={3}
          placeholder="e.g. It runs to 960 in 3 weeks, then drops to 850 by day 45"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
          className={cn(input, "max-h-40 resize-none")} />
        <div className="flex items-center justify-between gap-2">
          <button type="button" disabled={busy || messages.length === 0} onClick={() => { setHistories((current) => ({ ...current, [provider]: [] })); setError(""); }}
            className="text-xs text-ink-muted hover:text-ink disabled:opacity-40">
            New chat
          </button>
          {busy ? (
            <button type="button" onClick={() => request.current?.abort()} className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-soft">Stop</button>
          ) : (
            <button type="submit" disabled={!draft.trim()} className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40">Send</button>
          )}
        </div>
        <p className="text-micro text-ink-muted">AI can make mistakes. Model estimates for learning, not financial advice.</p>
      </form>
    </aside>
  );
}
