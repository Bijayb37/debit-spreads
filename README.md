# Callculator

A Next.js app for modeling eight option strategies with editable inputs, saved comparisons, scenario charts, and value tables: debit call spreads, debit put spreads, bull put spreads, call ratio spreads, put ratio spreads, call calendars, long calls, and long puts.

## Scenario desk

The home page is the scenario desk: one stock, several option strategies, and several what-if scenarios, each of which is a path over time.

- **Scenarios are paths.** A scenario has one to five steps, each with a stock price, a day and an optional IV, for example "up to $960 by day 20, then back to $850 by day 45". The stock moves in a straight line between steps. A last step with no day lands on the last expiry on the desk.
- **The outcome table** shows what each strategy has made or lost at the end of each scenario, marks the best per scenario, and ends each row with its odds-weighted, worst and best result. The "How likely?" row holds your own weights.
- **Along the way** shows the selected scenario step by step: the stock's path, each strategy's profit or loss day by day, and a table of every strategy at every step with its low and high point. A strategy that expires before a step keeps the result it had on its expiry day.
- **Every price, every date** is a grid of stock prices against days at a chosen IV. It shows which strategy is ahead in each cell, or one strategy's values, and lists every strategy for the cell you point at.
- **Changing the stock price** rescales existing strikes so each strategy keeps its moneyness.
- **The assistant** (`/api/desk-assistant`) can add, change and remove strategies and scenarios (including multi-step paths), set your odds, change the stock, and look up any price and day with `what_if`. It runs its tools on the server against the same pricing code as the page, sees the recalculated board, then answers. Gemini uses `GEMINI_API_KEY`; ChatGPT uses a key you paste in. Assistant changes can be undone.
- The desk is saved in the browser. The earlier calculator is at `/classic`.

The model lives in `src/lib/scenario-desk.ts`, the assistant's tools in `src/lib/desk-tools.ts`, and the page in `src/components/desk/`.

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

Use **Ask AI for help** at the top right, and choose **ChatGPT** or **Gemini**. ChatGPT needs your own API key in **Connections**. Gemini uses the server's `GEMINI_API_KEY` environment variable (set it in `.env.local` or your host's settings), so visitors do not enter a key for it. The model field is editable for models your API account can access. A key is used on the first question; entering it does not verify access.

The ChatGPT key and separate provider conversations stay in React memory and are cleared on reload. That key is sent over the app's `/api/ai-help` route to OpenAI, never written to local storage or logged by the route. The Gemini key never leaves the server. Serve deployed installations over HTTPS. No new dependency is required.

**Include current strategy** sends the selected strategy's inputs and modeled results with each question. Turn it off to ask without the current calculator data; earlier chat messages remain in the conversation until **New chat**. The most recent four exchanges are sent with each question, with individual messages capped at 8,000 characters. ChatGPT usage is billed to the supplied key; Gemini usage is billed to the server's key.

The route uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text) with `store: false`, and Gemini's [generateContent API](https://ai.google.dev/api/generate-content). It validates request sizes and roles, limits response tokens, times out after 50 seconds, and returns safe errors for invalid credentials, quotas, and provider failures. Provider retention policies still apply.

Run integration contract tests without making paid API calls:

```bash
node --test tests/ai-help.test.cjs
```
