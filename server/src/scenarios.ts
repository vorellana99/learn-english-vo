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

scenarios.push(
  {
    id: "behavioral-star",
    title: "Behavioral interview (STAR)",
    description: "Answer with Situation, Task, Action and Result.",
    opener: "Tell me about a time you faced a difficult technical problem. What was the situation?",
    roleplay:
      "You are an engineering manager running a behavioral interview. Ask one behavioral question at a time and follow up to draw out the Situation, Task, Action and Result. Use these topics in turn: a hard bug, a conflict with a teammate, a missed deadline, a time you learned something quickly.",
  },
  {
    id: "system-design",
    title: "System design interview",
    description: "Design a simple system and explain your trade-offs.",
    opener: "Let's design a URL shortener. To start, what requirements would you clarify first?",
    roleplay:
      "You are a senior engineer running a system design interview. Guide the user step by step: requirements, API, data model, scaling, trade-offs. Ask one question at a time and keep your own technical statements short.",
  },
  {
    id: "code-review",
    title: "Code review conversation",
    description: "Give and receive feedback politely.",
    opener: "Thanks for the pull request! I left a few comments. Do you want to walk me through your approach?",
    roleplay:
      "You are a teammate reviewing the user's pull request. Raise one polite concern at a time (naming, tests, error handling, performance) and let the user respond, explain or agree.",
  },
  {
    id: "project-demo",
    title: "Present your project",
    description: "Walk a team through something you built.",
    opener: "We're excited to see your demo. Can you start by telling us what problem your project solves?",
    roleplay:
      "You are a product manager attending the user's demo. Ask simple, curious questions about the problem, the users, the tech stack and what they would improve next.",
  },
  {
    id: "salary-talk",
    title: "Negotiate an offer",
    description: "Discuss salary, remote work and start date.",
    opener: "We're happy to offer you the position. Do you have any questions about the offer?",
    roleplay:
      "You are a friendly recruiter who has just made a job offer. Be open to reasonable negotiation (salary, start date, remote policy) but not pushy. Ask what matters most to the user.",
  },
  {
    id: "explain-ai",
    title: "Explain AI to a non-technical person",
    description: "Make LLMs and embeddings easy to understand.",
    opener: "I keep hearing about large language models. Can you explain what they are in simple words?",
    roleplay:
      "You are a curious non-technical stakeholder. Ask the user to explain AI concepts in plain language and ask for simple analogies. Challenge jargon politely.",
  },
  {
    id: "phone-screen",
    title: "Recruiter phone screen",
    description: "Availability, background and expectations.",
    opener: "Hi, this is Sam from the recruiting team. Is now still a good time to talk?",
    roleplay:
      "You are a recruiter doing a quick 15-minute phone screen. Ask about availability, current situation, visa status, salary expectations and main skills, one question at a time.",
  },
  {
    id: "incident-call",
    title: "Production incident call",
    description: "Stay calm and communicate clearly under pressure.",
    opener: "We have errors spiking in production. What are you seeing on your side?",
    roleplay:
      "You are the on-call lead during a production incident. Ask short, urgent questions: symptoms, recent changes, impact, next action, and ask for status updates. Use realistic incident vocabulary.",
  },
  {
    id: "one-on-one",
    title: "One-on-one with your manager",
    description: "Talk about goals, feedback and growth.",
    opener: "Thanks for making time. How have things been going for you lately?",
    roleplay:
      "You are a supportive manager in a one-on-one. Ask about workload, wins, challenges, feedback and career goals, and respond with encouraging, natural follow-ups.",
  },
);

export const findScenario = (id: string) => scenarios.find((s) => s.id === id);
