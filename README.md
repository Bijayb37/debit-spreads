# Callculator

A Next.js app for modeling eight option strategies with editable inputs, saved comparisons, scenario charts, and value tables: debit call spreads, debit put spreads, bull put spreads, call ratio spreads, put ratio spreads, call calendars, long calls, and long puts.

## What-if calculator

The home page answers one question with as little on screen as possible: what does my option position make or lose if the stock is at a given price, on a given day, at a given IV?

- **Setup** is one card: the stock (ticker, price today, IV today) and one strategy with its type, strikes, expiry and budget as plain inputs. A sentence underneath says what it costs, where it breaks even and what it can make or lose. "Compare with another" adds more strategies, up to six.
- **What if** has three sliders: stock price, days from today, and IV. The result updates as they move. One strategy shows a single large figure; several show one line each with a bar.
- **The chart** shows profit or loss across stock prices on the chosen day (and at expiry when there is one strategy). Clicking it sets the price.
- **Saved moments** keep points to compare side by side, such as $960 on day 20 and $850 on day 45. Selecting one loads it back into the sliders.
- **Every price and every date at once** is a collapsed grid for when the sliders are not enough.
- **Changing the stock price** rescales existing strikes so each strategy keeps its moneyness.
- **Everyday controls:** each strategy has an × to remove it, plus Duplicate and an optional name; "Start over" returns to the example; "Reset" puts the what-if back to today; "Copy link" shares the exact setup; Undo reverses edits and removals.
- **Ask AI** (`/api/desk-assistant`) opens a side panel. The assistant can set up the stock and strategies, move the what-if, save moments and look up any point. It runs its tools on the server against the same pricing code as the page, sees the recalculated numbers, then answers. Gemini uses `GEMINI_API_KEY`; ChatGPT uses a key you paste in. Its changes can be undone.
- The page is saved in the browser. The earlier calculator is at `/classic`.

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
