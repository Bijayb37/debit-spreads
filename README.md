# Debit Call Spread Lab

A Next.js app for modeling debit call spreads with editable inputs, scenario charts, and spread value tables.

## Run Locally

```bash
cd /Users/bijaybohora/Documents/personalApps/debitspreads
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To use the project port from recent local testing:

```bash
npm run dev -- -p 3002
```

## Project Layout

- `src/app` contains the app shell.
- `src/components/debit-call-spread-lab.tsx` contains the main interface.
- `src/lib/debit-call-spread.ts` contains the spread calculations.
