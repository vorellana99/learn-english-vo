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

/** Spanish translation of every interview question, shown behind the translate button. */
export const QUESTION_ES: Record<string, string> = {
  "Tell me about yourself and your background.": "Cuéntame sobre ti y tu trayectoria.",
  "Tell me about a time you faced a difficult technical problem. How did you solve it?": "Cuéntame de una vez que enfrentaste un problema técnico difícil. ¿Cómo lo resolviste?",
  "Describe a disagreement you had with a teammate. How did you handle it?": "Describe un desacuerdo que tuviste con un compañero. ¿Cómo lo manejaste?",
  "Tell me about a time you missed a deadline or made a mistake. What did you learn?": "Cuéntame de una vez que no cumpliste un plazo o cometiste un error. ¿Qué aprendiste?",
  "Give me an example of a time you learned a new technology quickly.": "Dame un ejemplo de una vez que aprendiste una tecnología nueva rápidamente.",
  "Tell me about a project you are proud of. What was your role?": "Cuéntame de un proyecto del que te sientas orgulloso. ¿Cuál fue tu papel?",
  "How do you handle feedback that you disagree with?": "¿Cómo manejas los comentarios con los que no estás de acuerdo?",
  "Why do you want to work for our company?": "¿Por qué quieres trabajar en nuestra empresa?",
  "Walk me through a recent project you built. What was the architecture?": "Explícame paso a paso un proyecto reciente que construiste. ¿Cuál era la arquitectura?",
  "How do you debug a problem that only happens in production?": "¿Cómo depuras un problema que solo ocurre en producción?",
  "How would you explain what an API is to a non-technical person?": "¿Cómo le explicarías qué es una API a una persona no técnica?",
  "What is the difference between a SQL and a NoSQL database, and when would you choose each?": "¿Cuál es la diferencia entre una base de datos SQL y una NoSQL, y cuándo elegirías cada una?",
  "How do you make sure your code is reliable? Talk about testing.": "¿Cómo te aseguras de que tu código sea confiable? Habla de las pruebas.",
  "Explain how a large language model works to a product manager.": "Explícale a un gerente de producto cómo funciona un modelo de lenguaje grande.",
  "How would you reduce hallucinations in an application that uses an LLM?": "¿Cómo reducirías las alucinaciones en una aplicación que usa un LLM?",
  "What is a technical decision you made that you would change today?": "¿Qué decisión técnica tomaste que cambiarías hoy?",
  "We want to design a URL shortener. What requirements would you clarify first?": "Queremos diseñar un acortador de URLs. ¿Qué requisitos aclararías primero?",
  "How would you design the data model and the API for it?": "¿Cómo diseñarías el modelo de datos y la API?",
  "How would you scale the service to millions of requests per day?": "¿Cómo escalarías el servicio a millones de solicitudes por día?",
  "Where could this system fail, and how would you make it more reliable?": "¿Dónde podría fallar este sistema y cómo lo harías más confiable?",
  "How would you add a chatbot that answers questions using our company documents?": "¿Cómo agregarías un chatbot que responda preguntas usando los documentos de nuestra empresa?",
  "What trade-offs did you make in your design, and why?": "¿Qué compromisos asumiste en tu diseño y por qué?",
  "Can you give me a quick overview of your experience?": "¿Puedes darme un resumen rápido de tu experiencia?",
  "What are you looking for in your next role?": "¿Qué buscas en tu próximo puesto?",
  "What is your current work authorization status in the United States?": "¿Cuál es tu situación actual de autorización de trabajo en Estados Unidos?",
  "What are your salary expectations?": "¿Cuáles son tus expectativas salariales?",
  "When would you be able to start?": "¿Cuándo podrías empezar?",
  "Do you have any questions for us?": "¿Tienes alguna pregunta para nosotros?",
};

export const questionEs = (question: string) => QUESTION_ES[question] ?? "";

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
