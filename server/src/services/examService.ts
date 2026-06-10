import { getDb } from '../db';
import { generateId, now } from '../utils';
import { getExamQuestions, saveExamPaper, generatePaper } from './paperService';
import { gradeAnswer } from './gradingService';
import type { Exam, ExamAttempt, ExamAnswer, ExamConfig, ExamQuestion } from '../types';

export function createExam(data: {
  name: string;
  description?: string;
  subjectId: string;
  duration: number;
  totalScore: number;
  passScore: number;
  startTime?: string | null;
  endTime?: string | null;
  allowBack?: boolean;
  showScore?: boolean;
  showAnswer?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  antiCheating?: boolean;
  creatorId?: string;
  config: ExamConfig;
}): { exam: Exam; questions: ExamQuestion[]; warnings: string[] } {
  const db = getDb();
  
  const paperResult = generatePaper(data.config);
  
  const id = generateId();
  const currentTime = now();
  
  db.prepare(`
    INSERT INTO exams (
      id, name, description, subject_id, duration, total_score, pass_score,
      status, start_time, end_time, allow_back, show_score, show_answer,
      shuffle_questions, shuffle_options, anti_cheating, creator_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.description || '', data.subjectId,
    data.duration, paperResult.totalScore, data.passScore,
    data.startTime || null, data.endTime || null,
    data.allowBack !== false ? 1 : 0,
    data.showScore ? 1 : 0,
    data.showAnswer ? 1 : 0,
    data.shuffleQuestions ? 1 : 0,
    data.shuffleOptions ? 1 : 0,
    data.antiCheating !== false ? 1 : 0,
    data.creatorId || null,
    currentTime, currentTime
  );
  
  saveExamPaper(id, paperResult.questions);
  
  const exam = getExamById(id)!;
  
  return {
    exam,
    questions: paperResult.questions,
    warnings: paperResult.warnings
  };
}

export function getExamById(id: string): Exam | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as any;
  
  if (!row) return null;
  
  return rowToExam(row);
}

function rowToExam(row: any): Exam {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    subjectId: row.subject_id,
    duration: row.duration,
    totalScore: row.total_score,
    passScore: row.pass_score,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    allowBack: !!row.allow_back,
    showScore: !!row.show_score,
    showAnswer: !!row.show_answer,
    shuffleQuestions: !!row.shuffle_questions,
    shuffleOptions: !!row.shuffle_options,
    antiCheating: !!row.anti_cheating,
    creatorId: row.creator_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function getExams(filter?: {
  subjectId?: string;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): { list: Exam[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const page = filter?.page || 1;
  const pageSize = filter?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  const whereClauses: string[] = [];
  const params: any[] = [];
  
  if (filter?.subjectId) {
    whereClauses.push('subject_id = ?');
    params.push(filter.subjectId);
  }
  
  if (filter?.status) {
    whereClauses.push('status = ?');
    params.push(filter.status);
  }
  
  if (filter?.keyword) {
    whereClauses.push('name LIKE ?');
    params.push(`%${filter.keyword}%`);
  }
  
  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  const totalRow = db.prepare(`
    SELECT COUNT(*) as count FROM exams ${whereSql}
  `).get(...params) as { count: number };
  
  const rows = db.prepare(`
    SELECT * FROM exams ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[];
  
  return {
    list: rows.map(rowToExam),
    total: totalRow.count,
    page,
    pageSize
  };
}

export function updateExam(id: string, data: Partial<Exam>): Exam | null {
  const db = getDb();
  const currentTime = now();
  
  const result = db.prepare(`
    UPDATE exams SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      subject_id = COALESCE(?, subject_id),
      duration = COALESCE(?, duration),
      total_score = COALESCE(?, total_score),
      pass_score = COALESCE(?, pass_score),
      status = COALESCE(?, status),
      start_time = ?,
      end_time = ?,
      allow_back = COALESCE(?, allow_back),
      show_score = COALESCE(?, show_score),
      show_answer = COALESCE(?, show_answer),
      shuffle_questions = COALESCE(?, shuffle_questions),
      shuffle_options = COALESCE(?, shuffle_options),
      anti_cheating = COALESCE(?, anti_cheating),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.name || null,
    data.description !== undefined ? data.description : null,
    data.subjectId || null,
    data.duration !== undefined ? data.duration : null,
    data.totalScore !== undefined ? data.totalScore : null,
    data.passScore !== undefined ? data.passScore : null,
    data.status || null,
    data.startTime !== undefined ? data.startTime : null,
    data.endTime !== undefined ? data.endTime : null,
    data.allowBack !== undefined ? (data.allowBack ? 1 : 0) : null,
    data.showScore !== undefined ? (data.showScore ? 1 : 0) : null,
    data.showAnswer !== undefined ? (data.showAnswer ? 1 : 0) : null,
    data.shuffleQuestions !== undefined ? (data.shuffleQuestions ? 1 : 0) : null,
    data.shuffleOptions !== undefined ? (data.shuffleOptions ? 1 : 0) : null,
    data.antiCheating !== undefined ? (data.antiCheating ? 1 : 0) : null,
    currentTime,
    id
  );
  
  if (result.changes === 0) return null;
  
  return getExamById(id);
}

export function deleteExam(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  return result.changes > 0;
}

export function startExam(examId: string, userId: string): {
  attempt: ExamAttempt;
  questions: ExamQuestion[];
} {
  const db = getDb();
  const exam = getExamById(examId);
  
  if (!exam) {
    throw new Error('考试不存在');
  }
  
  const existingAttempt = db.prepare(`
    SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ?
  `).get(examId, userId) as any;
  
  if (existingAttempt && existingAttempt.status !== 'not_started') {
    if (existingAttempt.status === 'in_progress') {
      const questions = getExamQuestions(examId);
      const answers = getExamAnswers(existingAttempt.id);
      
      return {
        attempt: rowToExamAttempt(existingAttempt),
        questions: questions
      };
    }
    throw new Error('您已参加过此考试');
  }
  
  const attemptId = generateId();
  const currentTime = now();
  
  if (existingAttempt) {
    db.prepare(`
      UPDATE exam_attempts SET
        status = 'in_progress',
        start_time = ?,
        updated_at = ?
      WHERE id = ?
    `).run(currentTime, currentTime, existingAttempt.id);
    
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(existingAttempt.id);
    const questions = getExamQuestions(examId);
    
    return {
      attempt: rowToExamAttempt(attempt),
      questions
    };
  }
  
  db.prepare(`
    INSERT INTO exam_attempts (
      id, exam_id, user_id, status, start_time,
      duration_used, total_score, cheating_count, screen_switch_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'in_progress', ?, 0, ?, 0, 0, ?, ?)
  `).run(
    attemptId, examId, userId, currentTime,
    exam.totalScore, currentTime, currentTime
  );
  
  const questions = getExamQuestions(examId);
  
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId);
  
  return {
    attempt: rowToExamAttempt(attempt),
    questions
  };
}

function rowToExamAttempt(row: any): ExamAttempt {
  return {
    id: row.id,
    examId: row.exam_id,
    userId: row.user_id,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    durationUsed: row.duration_used,
    totalScore: row.total_score,
    score: row.score,
    passed: row.passed ? true : false,
    cheatingCount: row.cheating_count,
    screenSwitchCount: row.screen_switch_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function saveAnswer(
  attemptId: string,
  questionId: string,
  userAnswer: string
): ExamAnswer {
  const db = getDb();
  
  const existing = db.prepare(`
    SELECT * FROM exam_answers WHERE attempt_id = ? AND question_id = ?
  `).get(attemptId, questionId) as any;
  
  const currentTime = now();
  
  if (existing) {
    db.prepare(`
      UPDATE exam_answers SET user_answer = ? WHERE id = ?
    `).run(userAnswer, existing.id);
    
    return getExamAnswerById(existing.id)!;
  }
  
  const id = generateId();
  
  db.prepare(`
    INSERT INTO exam_answers (
      id, attempt_id, question_id, user_answer, score, max_score
    ) VALUES (?, ?, ?, ?, 0, 0)
  `).run(id, attemptId, questionId, userAnswer);
  
  return getExamAnswerById(id)!;
}

export function getExamAnswerById(id: string): ExamAnswer | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM exam_answers WHERE id = ?').get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    userAnswer: row.user_answer,
    isCorrect: row.is_correct !== null ? !!row.is_correct : null,
    score: row.score,
    maxScore: row.max_score,
    gradedAt: row.graded_at,
    gradedBy: row.graded_by
  };
}

export function getExamAnswers(attemptId: string): ExamAnswer[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM exam_answers WHERE attempt_id = ?
  `).all(attemptId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    userAnswer: row.user_answer,
    isCorrect: row.is_correct !== null ? !!row.is_correct : null,
    score: row.score,
    maxScore: row.max_score,
    gradedAt: row.graded_at,
    gradedBy: row.graded_by
  }));
}

export function submitExam(attemptId: string, userId: string): {
  attempt: ExamAttempt;
  gradingTaskId: string;
} {
  const db = getDb();
  
  const attempt = db.prepare(`
    SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?
  `).get(attemptId, userId) as any;
  
  if (!attempt) {
    throw new Error('考试记录不存在');
  }
  
  if (attempt.status === 'submitted' || attempt.status === 'graded') {
    throw new Error('考试已提交');
  }
  
  const currentTime = now();
  
  db.prepare(`
    UPDATE exam_attempts SET
      status = 'submitted',
      end_time = ?,
      updated_at = ?
    WHERE id = ?
  `).run(currentTime, currentTime, attemptId);
  
  const gradingTaskId = gradeAnswer(attemptId);
  
  const updatedAttempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId);
  
  return {
    attempt: rowToExamAttempt(updatedAttempt),
    gradingTaskId
  };
}

export function getAttemptById(attemptId: string): ExamAttempt | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as any;
  return row ? rowToExamAttempt(row) : null;
}

export function getUserAttempts(userId: string, examId?: string): ExamAttempt[] {
  const db = getDb();
  
  let query = 'SELECT * FROM exam_attempts WHERE user_id = ?';
  const params: any[] = [userId];
  
  if (examId) {
    query += ' AND exam_id = ?';
    params.push(examId);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(rowToExamAttempt);
}

export function recordCheating(attemptId: string, type: 'screen_switch' | 'cheating'): void {
  const db = getDb();
  
  if (type === 'screen_switch') {
    db.prepare(`
      UPDATE exam_attempts SET screen_switch_count = screen_switch_count + 1 WHERE id = ?
    `).run(attemptId);
  } else {
    db.prepare(`
      UPDATE exam_attempts SET cheating_count = cheating_count + 1 WHERE id = ?
    `).run(attemptId);
  }
}

export function updateDurationUsed(attemptId: string, duration: number): void {
  const db = getDb();
  
  db.prepare(`
    UPDATE exam_attempts SET duration_used = ? WHERE id = ?
  `).run(duration, attemptId);
}

export function autoSubmitExpiredExams(): number {
  const db = getDb();
  const currentTime = new Date();
  
  const inProgress = db.prepare(`
    SELECT ea.*, e.duration FROM exam_attempts ea
    INNER JOIN exams e ON ea.exam_id = e.id
    WHERE ea.status = 'in_progress'
  `).all() as any[];
  
  let count = 0;
  
  for (const attempt of inProgress) {
    if (!attempt.start_time) continue;
    
    const startTime = new Date(attempt.start_time);
    const elapsed = (currentTime.getTime() - startTime.getTime()) / 1000;
    
    if (elapsed > attempt.duration * 60 + 300) {
      try {
        db.prepare(`
          UPDATE exam_attempts SET
            status = 'submitted',
            end_time = ?,
            duration_used = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          currentTime.toISOString(),
          attempt.duration * 60,
          currentTime.toISOString(),
          attempt.id
        );
        
        gradeAnswer(attempt.id);
        count++;
      } catch (e) {
        console.error('自动提交失败:', e);
      }
    }
  }
  
  return count;
}

setInterval(() => {
  try {
    autoSubmitExpiredExams();
  } catch (e) {
    console.error('自动检查超时考试失败:', e);
  }
}, 60 * 1000);
