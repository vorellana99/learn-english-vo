export interface Scenario {
  id: string;
  title: string;
  description: string;
  opener: string;
  roleplay: string;
}

export const scenarios: Scenario[] = [
  {
    id: "interview-intro",
    title: "Job interview: tell me about yourself",
    description: "HR screening for a full stack / AI engineer role.",
    opener: "Hi! Thanks for joining. Please tell me a little about yourself.",
    roleplay:
      "You are a friendly recruiter at a US tech company running a first screening interview for a full stack / AI engineer role. Ask one question at a time (background, experience, strengths, why this company).",
  },
  {
    id: "standup",
    title: "Daily standup",
    description: "Say what you did, what you will do and any blockers.",
    opener: "Good morning! It's your turn for the standup. What did you work on yesterday?",
    roleplay:
      "You are the engineering manager running a daily standup. Ask about yesterday, today and blockers, one question at a time, and react naturally to what the user says.",
  },
  {
    id: "bug-explain",
    title: "Explain a bug to a teammate",
    description: "Describe a problem and how you fixed it.",
    opener: "Hey, I saw the production alert earlier. Can you explain what happened?",
    roleplay:
      "You are a senior teammate asking the user to explain a production bug, its root cause and the fix. Ask follow-up questions one at a time.",
  },
  {
    id: "small-talk",
    title: "Small talk with a coworker",
    description: "Casual conversation at the office.",
    opener: "Hi! How was your weekend?",
    roleplay: "You are a friendly coworker making casual small talk at a US office.",
  },
];

export const findScenario = (id: string) => scenarios.find((s) => s.id === id);
