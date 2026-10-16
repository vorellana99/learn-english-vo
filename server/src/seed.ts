export interface SeedCard {
  front: string;
  back: string;
  level: "A1" | "A2" | "B1" | "B2";
  topic: string;
}

const c = (front: string, back: string, level: SeedCard["level"], topic: string): SeedCard => ({
  front,
  back,
  level,
  topic,
});

export const seedCards: SeedCard[] = [
  c("Hello, my name is ...", "Hola, mi nombre es ...", "A1", "basics"),
  c("I work as a developer.", "Trabajo como desarrollador.", "A1", "work"),
  c("Where do you work?", "¿Dónde trabajas?", "A1", "work"),
  c("I don't understand.", "No entiendo.", "A1", "basics"),
  c("Can you repeat that, please?", "¿Puedes repetir eso, por favor?", "A1", "basics"),
  c("I have a meeting at 10.", "Tengo una reunión a las 10.", "A1", "work"),
  c("computer", "computadora", "A1", "tech"),
  c("bug", "error de software", "A1", "tech"),
  c("website", "sitio web", "A1", "tech"),
  c("I am learning English.", "Estoy aprendiendo inglés.", "A1", "basics"),
  c("deadline", "fecha límite", "A2", "work"),
  c("I'm working on a new feature.", "Estoy trabajando en una nueva funcionalidad.", "A2", "work"),
  c("pull request", "solicitud de integración de cambios", "A2", "tech"),
  c("database", "base de datos", "A2", "tech"),
  c("deploy", "desplegar", "A2", "tech"),
  c("Could you help me with this?", "¿Podrías ayudarme con esto?", "A2", "work"),
  c("What's the status of the task?", "¿Cuál es el estado de la tarea?", "A2", "work"),
  c("I fixed the bug yesterday.", "Arreglé el error ayer.", "A2", "tech"),
  c("Tell me about yourself.", "Cuéntame sobre ti.", "B1", "interview"),
  c("What are your strengths?", "¿Cuáles son tus fortalezas?", "B1", "interview"),
  c("I have three years of experience with React.", "Tengo tres años de experiencia con React.", "B1", "interview"),
  c("scalability", "escalabilidad", "B1", "tech"),
  c("I'd like to walk you through my project.", "Me gustaría guiarte por mi proyecto.", "B1", "interview"),
  c("The service is down; we're investigating.", "El servicio está caído; estamos investigando.", "B1", "tech"),
  c("embeddings", "representaciones vectoriales (embeddings)", "B1", "ai"),
  c("I'd approach this problem by breaking it into smaller parts.", "Abordaría este problema dividiéndolo en partes más pequeñas.", "B2", "interview"),
  c("trade-off", "compromiso entre ventajas y desventajas", "B2", "tech"),
  c("We need to mitigate the risk of data loss.", "Necesitamos mitigar el riesgo de pérdida de datos.", "B2", "tech"),
  c("The model hallucinates when the context is missing.", "El modelo alucina cuando falta contexto.", "B2", "ai"),
  c("I'm confident I can ramp up quickly.", "Estoy seguro de que puedo ponerme al día rápido.", "B2", "interview"),
];
