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

Create a `.env` file in the repo root (it is git-ignored; the server loads it on start):

```bash
cp .env.example .env   # then put your ANTHROPIC_API_KEY in it
npm run dev
```

A variable already exported in your shell takes precedence over `.env`.

The model defaults to `claude-opus-5-5` (override with `CLAUDE_MODEL`). Every message you write is corrected
(in Spanish) and each mistake is saved and turned into a review card. Server-side refusal fallbacks are enabled.

## Voice

In a conversation mission, press 🎤 to speak in English (browser speech recognition, `en-US`) and 🔈 to hear
replies read aloud (toggle "Read replies aloud" for hands-free practice). Dictated messages show a clarity score
and tell the tutor the text came from speech so it ignores punctuation and flags likely mispronunciations.
Voice input works in Chrome, Edge and Safari; Firefox only gets the text chat. Audio is processed by the browser
vendor's speech service, not by this app.

## Reply suggestions in conversation missions

Hidden by default. Press 💡 "Need help answering?" on any question to open a help ladder (press again to hide it):
1. **Ideas** - what you could mention, in Spanish.
2. **Start like this** - the beginning of an English answer.
3. **Full answers** - three versions (Simple, Medium, Natural) with Spanish translation. Each one can be inserted
   in the text box, listened to, practiced out loud (word-by-word match) or saved as a review card.

The help for each next question is generated in the same call as the tutor's reply, so it costs no extra request; the
opening question's help is requested the first time you open the panel and cached per mission and level. How much help
you used is stored per answer. "✅ Finish & summary" gives a recap with your conversation rewritten more naturally,
phrases to keep and a comparison with your previous run. "🚫 Retry without help" repeats a mission with help disabled.

## Mock interview

Home → "Mock interview": 6 questions (behavioral, technical, system design, recruiter screen or a mix), answered in
writing or by voice, with no feedback until the end. Claude then evaluates the whole transcript and returns an overall
score, a CEFR estimate, five sub-scores, strengths and improvements (in Spanish), mistakes (saved as review cards) and a
better answer for each question. XP is awarded once per interview (50 + 1.5 × score).

## Shadowing

Home → "Shadowing": you hear a sentence (slow or normal speed), repeat it out loud, and every word is marked green
(heard) or red (missed) by comparing your speech with the target text. Each phrase can be retried; the best attempt
counts (1-10 XP). Words you miss often show up in the dashboard so you can listen to them again. The comparison runs
in the browser; only the score and missed words are saved.

## Roadmap

1. **Phase 1 (done):** spaced-repetition flashcards (290 cards A1→B2: work, tech, AI, interview, daily life), XP, streak, level progress A1 → B2, SQLite persistence.
2. **Phase 2 (done):** AI roleplay chat (13 missions: STAR, system design, code review, salary, incidents…) (interview / standup) with corrections via the Claude API (`ANTHROPIC_API_KEY`).
3. **Phase 3 (done):** adaptive daily session from error history, progress dashboard.
