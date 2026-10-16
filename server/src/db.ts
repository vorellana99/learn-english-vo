import Database from "better-sqlite3";
import { seedCards } from "./seed.js";

export type DB = Database.Database;

export function openDb(file = process.env.DB_FILE ?? "learn-english.db"): DB {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY,
      front TEXT NOT NULL UNIQUE,
      back TEXT NOT NULL,
      level TEXT NOT NULL,
      topic TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS card_state (
      card_id INTEGER PRIMARY KEY REFERENCES cards(id),
      ease REAL NOT NULL,
      interval_days INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      due TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      rating INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      xp INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      last_active TEXT
    );
    INSERT OR IGNORE INTO profile (id) VALUES (1);
  `);
  const insert = db.prepare("INSERT OR IGNORE INTO cards (front, back, level, topic) VALUES (?, ?, ?, ?)");
  db.transaction(() => {
    for (const s of seedCards) insert.run(s.front, s.back, s.level, s.topic);
  })();
  return db;
}
