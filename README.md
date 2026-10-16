# Learn English VO

Gamified English learning web app (A1 → B2) aimed at AI / full stack engineer job interviews in the USA.

**Stack:** React + TypeScript (Vite), Node + Express + TypeScript, SQLite (`better-sqlite3`).

## Run

```bash
npm install
npm run dev   # API on :3001, web on :5173
npm test
```

## AI chat setup

Export your key before starting (the server does not read `.env` files):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

The model defaults to `claude-opus-5-5` (override with `CLAUDE_MODEL`). Every message you write is corrected
(in Spanish) and each mistake is saved and turned into a review card. Server-side refusal fallbacks are enabled.

## Roadmap

1. **Phase 1 (done):** spaced-repetition flashcards, XP, streak, level progress A1 → B2, SQLite persistence.
2. **Phase 2 (done):** AI roleplay chat (interview / standup) with corrections via the Claude API (`ANTHROPIC_API_KEY`).
3. **Phase 3:** adaptive daily session from error history, progress dashboard.
