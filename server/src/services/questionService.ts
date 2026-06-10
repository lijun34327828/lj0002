import { getDb } from '../db';
import { generateId, now, hashQuestion } from '../utils';
import type { Question, QuestionOption, QuestionType, DifficultyLevel } from '../types';

export interface QuestionFilter {
  subjectId?: string;
  knowledgePointIds?: string[];
  type?: QuestionType;
  difficulty?: DifficultyLevel;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface QuestionListResult {
  list: Question[];
  total: number;
  page: number;
  pageSize: number;
}

function rowToQuestion(row: any, options: any[] = [], knowledgePointIds: string[] = []): Question {
  return {
    id: row.id,
    type: row.type,
    difficulty: row.difficulty,
    subjectId: row.subject_id,
    content: row.content,
    correctAnswer: row.correct_answer,
    analysis: row.analysis,
    score: row.score,
    status: row.status,
    creatorId: row.creator_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hash: row.hash,
    options: options.map(opt => ({
      id: opt.id,
      label: opt.label,
      content: opt.content,
      isCorrect: !!opt.is_correct
    })),
    knowledgePointIds
  };
}

export function getQuestions(filter: QuestionFilter): QuestionListResult {
  const db = getDb();
  const page = filter.page || 1;
  const pageSize = filter.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  const whereClauses: string[] = [];
  const params: any[] = [];
  
  if (filter.subjectId) {
    whereClauses.push('q.subject_id = ?');
    params.push(filter.subjectId);
  }
  
  if (filter.type) {
    whereClauses.push('q.type = ?');
    params.push(filter.type);
  }
  
  if (filter.difficulty) {
    whereClauses.push('q.difficulty = ?');
    params.push(filter.difficulty);
  }
  
  if (filter.status) {
    whereClauses.push('q.status = ?');
    params.push(filter.status);
  }
  
  if (filter.keyword) {
    whereClauses.push('q.content LIKE ?');
    params.push(`%${filter.keyword}%`);
  }
  
  if (filter.knowledgePointIds && filter.knowledgePointIds.length > 0) {
    const placeholders = filter.knowledgePointIds.map(() => '?').join(',');
    whereClauses.push(`q.id IN (
      SELECT question_id FROM question_knowledge 
      WHERE knowledge_point_id IN (${placeholders})
    )`);
    params.push(...filter.knowledgePointIds);
  }
  
  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  const totalRow = db.prepare(`
    SELECT COUNT(*) as count FROM questions q ${whereSql}
  `).get(...params) as { count: number };
  
  const rows = db.prepare(`
    SELECT q.* FROM questions q
    ${whereSql}
    ORDER BY q.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[];
  
  const list = rows.map(row => {
    const options = db.prepare(`
      SELECT * FROM question_options WHERE question_id = ? ORDER BY sort
    `).all(row.id) as any[];
    
    const kpRows = db.prepare(`
      SELECT knowledge_point_id FROM question_knowledge WHERE question_id = ?
    `).all(row.id) as { knowledge_point_id: string }[];
    
    return rowToQuestion(row, options, kpRows.map(k => k.knowledge_point_id));
  });
  
  return {
    list,
    total: totalRow.count,
    page,
    pageSize
  };
}

export function getQuestionById(id: string): Question | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as any;
  
  if (!row) return null;
  
  const options = db.prepare(`
    SELECT * FROM question_options WHERE question_id = ? ORDER BY sort
  `).all(id) as any[];
  
  const kpRows = db.prepare(`
    SELECT knowledge_point_id FROM question_knowledge WHERE question_id = ?
  `).all(id) as { knowledge_point_id: string }[];
  
  return rowToQuestion(row, options, kpRows.map(k => k.knowledge_point_id));
}

export function createQuestion(data: {
  type: QuestionType;
  difficulty: DifficultyLevel;
  subjectId: string;
  content: string;
  options?: QuestionOption[];
  correctAnswer: string;
  analysis?: string;
  score: number;
  knowledgePointIds?: string[];
  creatorId?: string;
}): Question {
  const db = getDb();
  
  const hash = hashQuestion({
    type: data.type,
    content: data.content,
    options: data.options,
    correctAnswer: data.correctAnswer
  });
  
  const id = generateId();
  const currentTime = now();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO questions (
        id, type, difficulty, subject_id, content, correct_answer,
        analysis, score, status, creator_id, hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)
    `).run(
      id, data.type, data.difficulty, data.subjectId, data.content,
      data.correctAnswer, data.analysis || '', data.score,
      data.creatorId || null, hash, currentTime, currentTime
    );
    
    if (data.options && data.options.length > 0) {
      const insertOption = db.prepare(`
        INSERT INTO question_options (id, question_id, label, content, is_correct, sort)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      data.options.forEach((opt, index) => {
        insertOption.run(
          generateId(), id, opt.label, opt.content,
          opt.isCorrect ? 1 : 0, index
        );
      });
    }
    
    if (data.knowledgePointIds && data.knowledgePointIds.length > 0) {
      const insertKp = db.prepare(`
        INSERT INTO question_knowledge (question_id, knowledge_point_id)
        VALUES (?, ?)
      `);
      
      data.knowledgePointIds.forEach(kpId => {
        insertKp.run(id, kpId);
      });
    }
  });
  
  transaction();
  
  return getQuestionById(id)!;
}

export function updateQuestion(id: string, data: Partial<{
  type: QuestionType;
  difficulty: DifficultyLevel;
  subjectId: string;
  content: string;
  options: QuestionOption[];
  correctAnswer: string;
  analysis: string;
  score: number;
  knowledgePointIds: string[];
}>): Question | null {
  const db = getDb();
  const existing = getQuestionById(id);
  
  if (!existing) return null;
  
  const hash = hashQuestion({
    type: data.type || existing.type,
    content: data.content || existing.content,
    options: data.options || existing.options,
    correctAnswer: data.correctAnswer || existing.correctAnswer
  });
  
  const currentTime = now();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE questions SET
        type = COALESCE(?, type),
        difficulty = COALESCE(?, difficulty),
        subject_id = COALESCE(?, subject_id),
        content = COALESCE(?, content),
        correct_answer = COALESCE(?, correct_answer),
        analysis = COALESCE(?, analysis),
        score = COALESCE(?, score),
        hash = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      data.type || null,
      data.difficulty || null,
      data.subjectId || null,
      data.content || null,
      data.correctAnswer || null,
      data.analysis !== undefined ? data.analysis : null,
      data.score !== undefined ? data.score : null,
      hash,
      currentTime,
      id
    );
    
    if (data.options) {
      db.prepare('DELETE FROM question_options WHERE question_id = ?').run(id);
      
      const insertOption = db.prepare(`
        INSERT INTO question_options (id, question_id, label, content, is_correct, sort)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      data.options.forEach((opt, index) => {
        insertOption.run(
          generateId(), id, opt.label, opt.content,
          opt.isCorrect ? 1 : 0, index
        );
      });
    }
    
    if (data.knowledgePointIds) {
      db.prepare('DELETE FROM question_knowledge WHERE question_id = ?').run(id);
      
      const insertKp = db.prepare(`
        INSERT INTO question_knowledge (question_id, knowledge_point_id)
        VALUES (?, ?)
      `);
      
      data.knowledgePointIds.forEach(kpId => {
        insertKp.run(id, kpId);
      });
    }
  });
  
  transaction();
  
  return getQuestionById(id);
}

export function deleteQuestion(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  return result.changes > 0;
}

export function checkDuplicateQuestions(questions: {
  type: string;
  content: string;
  options?: QuestionOption[];
  correctAnswer: string;
}[]): { index: number; existingQuestion: Question | null; hash: string }[] {
  const db = getDb();
  const results: { index: number; existingQuestion: Question | null; hash: string }[] = [];
  
  questions.forEach((q, index) => {
    const hash = hashQuestion(q);
    const existing = db.prepare('SELECT id FROM questions WHERE hash = ?').get(hash) as any;
    results.push({
      index,
      existingQuestion: existing ? getQuestionById(existing.id) : null,
      hash
    });
  });
  
  return results;
}

export function getQuestionsByHash(hashes: string[]): Question[] {
  const db = getDb();
  if (hashes.length === 0) return [];
  
  const placeholders = hashes.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT * FROM questions WHERE hash IN (${placeholders})
  `).all(...hashes) as any[];
  
  return rows.map(row => {
    const options = db.prepare(`
      SELECT * FROM question_options WHERE question_id = ? ORDER BY sort
    `).all(row.id) as any[];
    return rowToQuestion(row, options, []);
  });
}

export function bulkCreateQuestions(questions: Array<{
  type: QuestionType;
  difficulty: DifficultyLevel;
  subjectId: string;
  content: string;
  options?: QuestionOption[];
  correctAnswer: string;
  analysis?: string;
  score: number;
  knowledgePointIds?: string[];
  creatorId?: string;
}>): { created: number; skipped: number; questions: Question[] } {
  const created: Question[] = [];
  let skipped = 0;
  
  for (const q of questions) {
    const hash = hashQuestion(q);
    const db = getDb();
    const existing = db.prepare('SELECT id FROM questions WHERE hash = ?').get(hash);
    
    if (existing) {
      skipped++;
      continue;
    }
    
    const question = createQuestion(q);
    created.push(question);
  }
  
  return {
    created: created.length,
    skipped,
    questions: created
  };
}

export function getKnowledgePoints(subjectId?: string, parentId?: string | null): any[] {
  const db = getDb();
  
  if (subjectId && parentId !== undefined) {
    return db.prepare(`
      SELECT * FROM knowledge_points 
      WHERE subject_id = ? AND parent_id IS ? 
      ORDER BY sort, name
    `).all(subjectId, parentId) as any[];
  }
  
  if (subjectId) {
    return db.prepare(`
      SELECT * FROM knowledge_points WHERE subject_id = ? ORDER BY level, sort, name
    `).all(subjectId) as any[];
  }
  
  return db.prepare('SELECT * FROM knowledge_points ORDER BY subject_id, level, sort').all() as any[];
}

export function getSubjects(): any[] {
  const db = getDb();
  return db.prepare('SELECT * FROM subjects ORDER BY name').all() as any[];
}

export function createSubject(name: string, description?: string): any {
  const db = getDb();
  const id = generateId();
  const currentTime = now();
  
  db.prepare(`
    INSERT INTO subjects (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || '', currentTime, currentTime);
  
  return db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
}

export function createKnowledgePoint(data: {
  name: string;
  parentId?: string | null;
  subjectId: string;
  level?: number;
  sort?: number;
}): any {
  const db = getDb();
  const id = generateId();
  const currentTime = now();
  
  db.prepare(`
    INSERT INTO knowledge_points (id, name, parent_id, subject_id, level, sort, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.parentId || null, data.subjectId,
    data.level || 1, data.sort || 0, currentTime, currentTime
  );
  
  return db.prepare('SELECT * FROM knowledge_points WHERE id = ?').get(id);
}
