# Callculator

A Next.js app for modeling eight option strategies with editable inputs, saved comparisons, scenario charts, and value tables: debit call spreads, debit put spreads, bull put spreads, call ratio spreads, put ratio spreads, call calendars, long calls, and long puts.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To use a different port:

```bash
npm run dev -- -p 3002
```

## Project Layout

- `src/app` contains the app shell, educational pages, metadata, and AI-help route.
- `src/components/debit-call-spread-lab.tsx` contains the setup, comparisons, workspace state, and time-value chart.
- `src/components/debit-spread-scenario-visualizer.tsx` contains the heat map, multi-date chart, and scenario table.
- `src/components/ai-help.tsx` contains the AI-help panel.
- `src/lib/debit-call-spread.ts` contains pricing, sizing, Greeks, and scenario calculations.
- `src/lib/options/debitSpreadScenarios.ts` builds scenario grids.
- `src/lib/iv-comparison.ts` finds equivalent strategies under different volatility assumptions.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Type checking rejects unused local declarations and parameters. Tests cover ratio-spread calculations and AI-help request handling; provider requests are mocked.

## AI Help

Use **Ask AI for help** at the top right, choose **ChatGPT** or **Gemini**, and enter that provider's API key in **Connections**. Both connections can be configured independently. The model field is editable for models your API account can access. A key is used on the first question; entering it does not verify access.

Keys and separate provider conversations stay in React memory and are cleared on reload. Keys are sent over the app's `/api/ai-help` route to the selected provider, never written to local storage or logged by the route. Serve deployed installations over HTTPS. No shared server API key or new dependency is required.

**Include current strategy** sends the selected strategy's inputs and modeled results with each question. Turn it off to ask without the current calculator data; earlier chat messages remain in the conversation until **New chat**. The most recent four exchanges are sent with each question, with individual messages capped at 8,000 characters. Provider API usage is billed to the supplied key.

The route uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text) with `store: false`, and Gemini's [generateContent API](https://ai.google.dev/api/generate-content). It validates request sizes and roles, limits response tokens, times out after 50 seconds, and returns safe errors for invalid credentials, quotas, and provider failures. Provider retention policies still apply.

Run integration contract tests without making paid API calls:

```bash
node --test tests/ai-help.test.cjs
```
