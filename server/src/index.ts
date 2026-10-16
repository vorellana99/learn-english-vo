import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

// Load <repo>/.env (variables already set in the environment win).
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const port = Number(process.env.PORT ?? 3001);
createApp(openDb()).listen(port, () => console.log(`API listening on http://localhost:${port}`));
