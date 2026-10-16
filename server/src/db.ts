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
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS mistakes (
      id INTEGER PRIMARY KEY,
      category TEXT NOT NULL,
      original TEXT NOT NULL,
      fixed TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      overall INTEGER,
      report TEXT,
      xp_awarded INTEGER,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS interview_turns (
      id INTEGER PRIMARY KEY,
      interview_id INTEGER NOT NULL REFERENCES interviews(id),
      idx INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      spoken INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO profile (id) VALUES (1);
  `);
  const insert = db.prepare("INSERT OR IGNORE INTO cards (front, back, level, topic) VALUES (?, ?, ?, ?)");
  db.transaction(() => {
    for (const s of seedCards) insert.run(s.front, s.back, s.level, s.topic);
  })();
  return db;
}
