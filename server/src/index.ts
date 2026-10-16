import { openDb } from "./db.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
createApp(openDb()).listen(port, () => console.log(`API listening on http://localhost:${port}`));
