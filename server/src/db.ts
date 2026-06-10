import Database from 'better-sqlite3';
import { config } from './config';
import fs from 'fs';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_points (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      subject_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES knowledge_points(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password TEXT NOT NULL,
      real_name TEXT,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      content TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      analysis TEXT,
      score REAL NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'approved',
      creator_id TEXT,
      hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS question_knowledge (
      question_id TEXT NOT NULL,
      knowledge_point_id TEXT NOT NULL,
      PRIMARY KEY (question_id, knowledge_point_id),
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      subject_id TEXT NOT NULL,
      duration INTEGER NOT NULL,
      total_score REAL NOT NULL,
      pass_score REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      start_time TEXT,
      end_time TEXT,
      allow_back INTEGER NOT NULL DEFAULT 1,
      show_score INTEGER NOT NULL DEFAULT 0,
      show_answer INTEGER NOT NULL DEFAULT 0,
      shuffle_questions INTEGER NOT NULL DEFAULT 0,
      shuffle_options INTEGER NOT NULL DEFAULT 0,
      anti_cheating INTEGER NOT NULL DEFAULT 1,
      creator_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0,
      score REAL NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 0,
      question_snapshot TEXT,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      start_time TEXT,
      end_time TEXT,
      duration_used INTEGER NOT NULL DEFAULT 0,
      total_score REAL NOT NULL DEFAULT 0,
      score REAL,
      passed INTEGER,
      cheating_count INTEGER NOT NULL DEFAULT 0,
      screen_switch_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(exam_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS exam_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      user_answer TEXT,
      is_correct INTEGER,
      score REAL NOT NULL DEFAULT 0,
      max_score REAL NOT NULL DEFAULT 0,
      graded_at TEXT,
      graded_by TEXT,
      FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wrong_questions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      exam_attempt_id TEXT,
      user_answer TEXT,
      correct_answer TEXT,
      wrong_count INTEGER NOT NULL DEFAULT 1,
      last_wrong_time TEXT NOT NULL,
      UNIQUE(user_id, question_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grading_tasks (
      id TEXT PRIMARY KEY,
      exam_attempt_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_questions INTEGER NOT NULL,
      graded_questions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (exam_attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
    CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
    CREATE INDEX IF NOT EXISTS idx_questions_hash ON questions(hash);
    CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON exam_answers(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON wrong_questions(user_id);
  `);
}

export default getDb;
