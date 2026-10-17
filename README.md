# Learn English VO

Gamified English learning web app (A1 → B2) aimed at AI / full stack engineer job interviews in the USA.

**Stack:** React + TypeScript (Vite), Node + Express + TypeScript, SQLite (`better-sqlite3`).

## Run

Requires Node 22 or newer (tested on 22 and 24; `.nvmrc` pins 24). `better-sqlite3` is a native module: v12+ ships prebuilt
binaries for Node 24, while v11 had none and needed a C++ build toolchain on your machine.

npm 12 blocks dependency install scripts unless they are approved. The ones this project needs (`better-sqlite3`, which
downloads its binary, and `esbuild`) are approved in the `allowScripts` field of `package.json`. If you bump either
package, run `npm install-scripts approve --all` and commit the change; otherwise SQLite fails to load with
"Could not locate the bindings file".

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

The model defaults to `claude-opus-5-5` (override with `CLAUDE_MODEL`). One small job, the step-1 **ideas** of the help ladder, uses
a fast model instead, `claude-haiku-5-5` by default (override with `CLAUDE_FAST_MODEL`), with thinking off and low effort;
if that call fails it is retried once with the main model. Every message you write is corrected
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

The help for each next question is generated in the same call as the tutor's reply, so it costs no extra request. For
the opening question help is loaded one step at a time: opening the panel requests only the ideas (fast model), and the
starter plus the full answers (main model) are requested when you ask for the starter. Every step is cached per mission
and level. How much help
you used is stored per answer. "✅ Finish & summary" gives a recap with your conversation rewritten more naturally,
phrases to keep and a comparison with your previous run. "🚫 Retry without help" repeats a mission with help disabled.

## Spanish translations

A reusable `Translate` component (`client/src/Translate.tsx`) puts a translator icon button (an "A" next to a Japanese-style character, drawn as SVG) next to English text; pressing it shows
the Spanish version in a floating bubble, and pressing it again (or Escape, or clicking elsewhere) hides it. It is used
on every tutor message, on each idea / starter / answer in the help ladder, in the mission summary, in shadowing phrases
and in interview questions. The same icon in the header switches on "always show translations", which shows them
inline instead and is remembered in the browser. Translations of tutor replies, ideas and summaries come from the same
Claude call as the content; scenario openers and interview questions have hand-written translations.

Suggested answers are written out in full, with concrete believable details (a job title, years of experience, real
technologies) and never `[brackets]`, so you can say them as they are and edit the details if they are not true for you.

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
