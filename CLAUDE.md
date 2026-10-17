# Learn English VO

React + TypeScript (Vite) client, Node + Express + TypeScript server, SQLite (`better-sqlite3`), Claude API for the AI features.

## Commands

- `npm run dev` runs the API (:3001) and the web app (:5173); `npm test`, `npm run typecheck`, `npm run build -w client`.
- The server loads `<repo>/.env` (`ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL`, `PORT`).

## Conventions

- Work happens on `develop`; do not push to `main` directly.
- Spanish translations of English text always use the `<Translate es="..." />` component (`client/src/Translate.tsx`): the same icon-only round translator button (the `TranslateIcon` SVG, not an emoji) everywhere, with the floating bubble. Do not add text labels, other sizes or variants to it.
- AI calls go through `server/src/claude.ts` (`parseStructured`) and are injected into routes, so tests use fakes and never call the API.
