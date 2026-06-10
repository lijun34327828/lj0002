import { getDb } from '../db';
import { generateId, now, calculateKnowledgeWeakness } from '../utils';
import type { ExamAnswer, Question } from '../types';

const gradingQueue: string[] = [];
let isProcessing = false;

export function gradeAnswer(attemptId: string): string {
  const db = getDb();
  
  const taskId = generateId();
  const currentTime = now();
  
  const answers = db.prepare(`
    SELECT * FROM exam_answers WHERE attempt_id = ?
  `).all(attemptId) as any[];
  
  db.prepare(`
    INSERT INTO grading_tasks (
      id, exam_attempt_id, status, total_questions, created_at
    ) VALUES (?, ?, 'pending', ?, ?)
  `).run(taskId, attemptId, answers.length, currentTime);
  
  addToGradingQueue(attemptId, taskId);
  
  return taskId;
}

function addToGradingQueue(attemptId: string, taskId: string): void {
  gradingQueue.push(attemptId);
  
  if (!isProcessing) {
    processGradingQueue();
  }
}

async function processGradingQueue(): Promise<void> {
  if (isProcessing || gradingQueue.length === 0) return;
  
  isProcessing = true;
  
  while (gradingQueue.length > 0) {
    const attemptId = gradingQueue.shift()!;
    
    try {
      await gradeAttempt(attemptId);
    } catch (error) {
      console.error('判分失败:', attemptId, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  isProcessing = false;
}

async function gradeAttempt(attemptId: string): Promise<void> {
  const db = getDb();
  
  db.prepare(`
    UPDATE grading_tasks SET
      status = 'processing',
      started_at = ?
    WHERE exam_attempt_id = ? AND status = 'pending'
  `).run(now(), attemptId);
  
  const answers = db.prepare(`
    SELECT ea.*, eq.question_snapshot, eq.score as question_score
    FROM exam_answers ea
    INNER JOIN exam_questions eq ON ea.question_id = eq.question_id
    WHERE ea.attempt_id = ?
  `).all(attemptId) as any[];
  
  let totalScore = 0;
  let gradedCount = 0;
  let hasSubjective = false;
  const wrongQuestions: Array<{
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
  }> = [];
  
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as any;
  
  for (const answer of answers) {
    const question: Question = answer.question_snapshot
      ? JSON.parse(answer.question_snapshot)
      : null;
    
    if (!question) continue;
    
    const result = gradeSingleQuestion(question, answer.user_answer);
    
    db.prepare(`
      UPDATE exam_answers SET
        is_correct = ?,
        score = ?,
        max_score = ?,
        graded_at = ?,
        graded_by = 'system'
      WHERE id = ?
    `).run(
      result.isCorrect === null ? null : (result.isCorrect ? 1 : 0),
      result.score,
      answer.question_score,
      result.isGraded ? now() : null,
      answer.id
    );
    
    if (result.isGraded) {
      totalScore += result.score;
      gradedCount++;
      
      if (!result.isCorrect) {
        wrongQuestions.push({
          questionId: question.id,
          userAnswer: answer.user_answer || '',
          correctAnswer: question.correctAnswer
        });
      }
    } else {
      hasSubjective = true;
    }
  }
  
  const status = hasSubjective ? 'reviewing' : 'graded';
  const finalScore = hasSubjective ? null : totalScore;
  const passed = hasSubjective ? null : (totalScore >= attempt.pass_score ? 1 : 0);
  
  db.prepare(`
    UPDATE exam_attempts SET
      status = ?,
      score = ?,
      passed = ?,
      updated_at = ?
    WHERE id = ?
  `).run(status, finalScore, passed, now(), attemptId);
  
  if (attempt.user_id) {
    updateWrongQuestions(attempt.user_id, attemptId, wrongQuestions);
  }
  
  db.prepare(`
    UPDATE grading_tasks SET
      status = ?,
      graded_questions = ?,
      completed_at = ?
    WHERE exam_attempt_id = ?
  `).run(status, gradedCount, now(), attemptId);
}

interface GradingResult {
  isCorrect: boolean | null;
  score: number;
  isGraded: boolean;
}

function gradeSingleQuestion(question: Question, userAnswer: string | null): GradingResult {
  if (!userAnswer && userAnswer !== '') {
    return { isCorrect: false, score: 0, isGraded: true };
  }
  
  const questionType = question.type;
  
  switch (questionType) {
    case 'single_choice':
    case 'true_false': {
      const isCorrect = userAnswer === question.correctAnswer;
      return {
        isCorrect,
        score: isCorrect ? question.score : 0,
        isGraded: true
      };
    }
    
    case 'multiple_choice': {
      const userAnswers = userAnswer.split(',').sort().join(',');
      const correctAnswers = question.correctAnswer.split(',').sort().join(',');
      const isCorrect = userAnswers === correctAnswers;
      return {
        isCorrect,
        score: isCorrect ? question.score : 0,
        isGraded: true
      };
    }
    
    case 'fill_blank': {
      const normalizedUser = normalizeText(userAnswer);
      const normalizedCorrect = normalizeText(question.correctAnswer);
      const isCorrect = normalizedUser === normalizedCorrect;
      return {
        isCorrect,
        score: isCorrect ? question.score : 0,
        isGraded: true
      };
    }
    
    case 'short_answer':
    case 'essay': {
      return {
        isCorrect: null,
        score: 0,
        isGraded: false
      };
    }
    
    default:
      return { isCorrect: false, score: 0, isGraded: true };
  }
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：""''（）【】《》]/g, '')
    .replace(/[,!?;:\'\"\(\)\[\]<>]/g, '');
}

function updateWrongQuestions(
  userId: string,
  attemptId: string,
  wrongQuestions: Array<{
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
  }>
): void {
  const db = getDb();
  
  for (const wq of wrongQuestions) {
    const existing = db.prepare(`
      SELECT * FROM wrong_questions WHERE user_id = ? AND question_id = ?
    `).get(userId, wq.questionId) as any;
    
    if (existing) {
      db.prepare(`
        UPDATE wrong_questions SET
          wrong_count = wrong_count + 1,
          user_answer = ?,
          correct_answer = ?,
          last_wrong_time = ?,
          exam_attempt_id = ?
        WHERE id = ?
      `).run(wq.userAnswer, wq.correctAnswer, now(), attemptId, existing.id);
    } else {
      db.prepare(`
        INSERT INTO wrong_questions (
          id, user_id, question_id, exam_attempt_id,
          user_answer, correct_answer, wrong_count, last_wrong_time
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        generateId(), userId, wq.questionId, attemptId,
        wq.userAnswer, wq.correctAnswer, now()
      );
    }
  }
}

export function gradeSubjectiveQuestion(
  answerId: string,
  score: number,
  graderId: string
): ExamAnswer | null {
  const db = getDb();
  
  const answer = db.prepare('SELECT * FROM exam_answers WHERE id = ?').get(answerId) as any;
  if (!answer) return null;
  
  db.prepare(`
    UPDATE exam_answers SET
      score = ?,
      is_correct = ?,
      graded_at = ?,
      graded_by = ?
    WHERE id = ?
  `).run(
    score,
    score > 0 ? 1 : 0,
    now(),
    graderId,
    answerId
  );
  
  recalculateAttemptScore(answer.attempt_id);
  
  return getAnswerById(answerId);
}

function getAnswerById(id: string): ExamAnswer | null {
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

function recalculateAttemptScore(attemptId: string): void {
  const db = getDb();
  
  const answers = db.prepare(`
    SELECT * FROM exam_answers WHERE attempt_id = ?
  `).all(attemptId) as any[];
  
  let totalScore = 0;
  let allGraded = true;
  
  for (const answer of answers) {
    if (answer.graded_at) {
      totalScore += answer.score;
    } else {
      allGraded = false;
    }
  }
  
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as any;
  
  if (allGraded) {
    db.prepare(`
      UPDATE exam_attempts SET
        score = ?,
        status = 'graded',
        passed = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      totalScore,
      totalScore >= attempt.pass_score ? 1 : 0,
      now(),
      attemptId
    );
  }
}

export function getGradingTask(taskId: string): any {
  const db = getDb();
  return db.prepare('SELECT * FROM grading_tasks WHERE id = ?').get(taskId);
}

export function getWrongQuestions(userId: string, filter?: {
  subjectId?: string;
  page?: number;
  pageSize?: number;
}): { list: any[]; total: number } {
  const db = getDb();
  const page = filter?.page || 1;
  const pageSize = filter?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  const whereClauses: string[] = ['wq.user_id = ?'];
  const params: any[] = [userId];
  
  if (filter?.subjectId) {
    whereClauses.push('q.subject_id = ?');
    params.push(filter.subjectId);
  }
  
  const whereSql = 'WHERE ' + whereClauses.join(' AND ');
  
  const totalRow = db.prepare(`
    SELECT COUNT(*) as count FROM wrong_questions wq
    INNER JOIN questions q ON wq.question_id = q.id
    ${whereSql}
  `).get(...params) as { count: number };
  
  const rows = db.prepare(`
    SELECT wq.*, q.type, q.difficulty, q.content, q.subject_id
    FROM wrong_questions wq
    INNER JOIN questions q ON wq.question_id = q.id
    ${whereSql}
    ORDER BY wq.last_wrong_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[];
  
  return {
    list: rows,
    total: totalRow.count
  };
}

export function getKnowledgeWeakness(userId: string, subjectId?: string): any[] {
  const db = getDb();
  
  let query = `
    SELECT 
      qk.knowledge_point_id as kp_id,
      kp.name as kp_name,
      kp.parent_id as parent_id,
      COUNT(*) as total_questions,
      SUM(CASE WHEN ea.is_correct = 1 THEN 1 ELSE 0 END) as correct_count
    FROM exam_answers ea
    INNER JOIN exam_attempts eat ON ea.attempt_id = eat.id
    INNER JOIN question_knowledge qk ON ea.question_id = qk.question_id
    INNER JOIN knowledge_points kp ON qk.knowledge_point_id = kp.id
    INNER JOIN questions q ON ea.question_id = q.id
    WHERE eat.user_id = ? AND ea.graded_at IS NOT NULL
  `;
  const params: any[] = [userId];
  
  if (subjectId) {
    query += ' AND q.subject_id = ?';
    params.push(subjectId);
  }
  
  query += ' GROUP BY qk.knowledge_point_id ORDER BY correct_count / COUNT(*) ASC';
  
  const rows = db.prepare(query).all(...params) as any[];
  
  return rows.map(row => ({
    knowledgePointId: row.kp_id,
    knowledgePointName: row.kp_name,
    parentId: row.parent_id,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    accuracy: row.total_questions > 0 ? Math.round((row.correct_count / row.total_questions) * 100) : 0
  }));
}

export function publishExamResults(attemptId: string): boolean {
  const db = getDb();
  
  const result = db.prepare(`
    UPDATE exam_attempts SET status = 'published', updated_at = ?
    WHERE id = ? AND status = 'graded'
  `).run(now(), attemptId);
  
  return result.changes > 0;
}
