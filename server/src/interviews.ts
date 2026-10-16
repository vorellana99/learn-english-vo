export interface InterviewType {
  id: string;
  title: string;
  description: string;
  questions: string[];
}

export const QUESTIONS_PER_INTERVIEW = 6;

export const interviewTypes: InterviewType[] = [
  {
    id: "behavioral",
    title: "Behavioral interview",
    description: "Stories about teamwork, conflict and problem solving (use STAR).",
    questions: [
      "Tell me about yourself and your background.",
      "Tell me about a time you faced a difficult technical problem. How did you solve it?",
      "Describe a disagreement you had with a teammate. How did you handle it?",
      "Tell me about a time you missed a deadline or made a mistake. What did you learn?",
      "Give me an example of a time you learned a new technology quickly.",
      "Tell me about a project you are proud of. What was your role?",
      "How do you handle feedback that you disagree with?",
      "Why do you want to work for our company?",
    ],
  },
  {
    id: "technical-talk",
    title: "Technical conversation",
    description: "Explain your projects and technical decisions out loud.",
    questions: [
      "Walk me through a recent project you built. What was the architecture?",
      "How do you debug a problem that only happens in production?",
      "How would you explain what an API is to a non-technical person?",
      "What is the difference between a SQL and a NoSQL database, and when would you choose each?",
      "How do you make sure your code is reliable? Talk about testing.",
      "Explain how a large language model works to a product manager.",
      "How would you reduce hallucinations in an application that uses an LLM?",
      "What is a technical decision you made that you would change today?",
    ],
  },
  {
    id: "system-design",
    title: "System design talk",
    description: "Think aloud while designing a system and explain trade-offs.",
    questions: [
      "We want to design a URL shortener. What requirements would you clarify first?",
      "How would you design the data model and the API for it?",
      "How would you scale the service to millions of requests per day?",
      "Where could this system fail, and how would you make it more reliable?",
      "How would you add a chatbot that answers questions using our company documents?",
      "What trade-offs did you make in your design, and why?",
    ],
  },
  {
    id: "hr-screen",
    title: "Recruiter screen",
    description: "Availability, visa, salary and motivation.",
    questions: [
      "Can you give me a quick overview of your experience?",
      "What are you looking for in your next role?",
      "What is your current work authorization status in the United States?",
      "What are your salary expectations?",
      "When would you be able to start?",
      "Do you have any questions for us?",
    ],
  },
  {
    id: "mixed",
    title: "Full mock interview",
    description: "A mix of behavioral, technical and system design questions.",
    questions: [],
  },
];

export const findInterviewType = (id: string) => interviewTypes.find((t) => t.id === id);

const shuffle = <T>(items: T[], rnd: () => number) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Always opens with an introduction question, then picks the rest at random. */
export function pickQuestions(type: InterviewType, rnd: () => number = Math.random): string[] {
  const pool =
    type.id === "mixed"
      ? ["behavioral", "technical-talk", "system-design"].flatMap((id) => shuffle(findInterviewType(id)!.questions, rnd).slice(0, 3))
      : type.questions;
  const opener = type.id === "mixed" ? "Tell me about yourself and your background." : pool[0];
  const rest = shuffle(
    pool.filter((q) => q !== opener),
    rnd,
  );
  return [opener, ...rest].slice(0, QUESTIONS_PER_INTERVIEW);
}
