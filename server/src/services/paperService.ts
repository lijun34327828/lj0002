import { getDb } from '../db';
import { generateId, now, shuffleArray, pickRandom } from '../utils';
import { getQuestionById } from './questionService';
import type { Question, Exam, ExamQuestion, ExamConfig, DifficultyLevel, QuestionType } from '../types';

export interface PaperGenerationResult {
  success: boolean;
  questions: ExamQuestion[];
  totalScore: number;
  difficultyStats: { [key: string]: number };
  typeStats: { [key: string]: number };
  knowledgeCoverage: number;
  requiredCoverage: number;
  warnings: string[];
}

interface QuestionPool {
  [key: string]: Question[];
}

function getPoolKey(difficulty: string, type: string): string {
  return `${difficulty}_${type}`;
}

function buildQuestionPool(
  subjectId: string,
  knowledgePointIds?: string[]
): QuestionPool {
  const db = getDb();
  const pool: QuestionPool = {};
  
  let query = `
    SELECT DISTINCT q.* FROM questions q
    INNER JOIN question_knowledge qk ON q.id = qk.question_id
    WHERE q.subject_id = ? AND q.status = 'approved'
  `;
  const params: any[] = [subjectId];
  
  if (knowledgePointIds && knowledgePointIds.length > 0) {
    const placeholders = knowledgePointIds.map(() => '?').join(',');
    query += ` AND qk.knowledge_point_id IN (${placeholders})`;
    params.push(...knowledgePointIds);
  }
  
  const rows = db.prepare(query).all(...params) as any[];
  
  for (const row of rows) {
    const options = db.prepare(`
      SELECT * FROM question_options WHERE question_id = ? ORDER BY sort
    `).all(row.id) as any[];
    
    const kpRows = db.prepare(`
      SELECT knowledge_point_id FROM question_knowledge WHERE question_id = ?
    `).all(row.id) as { knowledge_point_id: string }[];
    
    const question: Question = {
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
      knowledgePointIds: kpRows.map(k => k.knowledge_point_id)
    };
    
    const key = getPoolKey(row.difficulty, row.type);
    if (!pool[key]) {
      pool[key] = [];
    }
    pool[key].push(question);
  }
  
  return pool;
}

function calculateKnowledgeCoverage(
  questions: Question[],
  targetKnowledgePointIds: string[]
): number {
  if (targetKnowledgePointIds.length === 0) return 100;
  
  const coveredKps = new Set<string>();
  for (const q of questions) {
    for (const kpId of q.knowledgePointIds) {
      if (targetKnowledgePointIds.includes(kpId)) {
        coveredKps.add(kpId);
      }
    }
  }
  
  return Math.round((coveredKps.size / targetKnowledgePointIds.length) * 100);
}

function collectAllKnowledgePoints(
  subjectId: string,
  parentKpIds?: string[]
): string[] {
  const db = getDb();
  
  if (parentKpIds && parentKpIds.length > 0) {
    const allKps = new Set<string>();
    
    const collectChildren = (parentId: string) => {
      allKps.add(parentId);
      const children = db.prepare(`
        SELECT id FROM knowledge_points WHERE parent_id = ?
      `).all(parentId) as { id: string }[];
      children.forEach(child => collectChildren(child.id));
    };
    
    parentKpIds.forEach(kpId => collectChildren(kpId));
    return Array.from(allKps);
  }
  
  const rows = db.prepare(`
    SELECT id FROM knowledge_points WHERE subject_id = ?
  `).all(subjectId) as { id: string }[];
  
  return rows.map(r => r.id);
}

export function generatePaper(config: ExamConfig): PaperGenerationResult {
  const warnings: string[] = [];
  
  const allKnowledgePointIds = collectAllKnowledgePoints(
    config.subjectId,
    config.knowledgePointIds
  );
  
  const pool = buildQuestionPool(config.subjectId, allKnowledgePointIds);
  
  const totalQuestions = config.totalQuestions;
  const requiredIds = config.requiredQuestionIds || [];
  const requiredQuestions: Question[] = [];
  
  for (const reqId of requiredIds) {
    const q = getQuestionById(reqId);
    if (q) {
      requiredQuestions.push(q);
    } else {
      warnings.push(`未找到必考题: ${reqId}`);
    }
  }
  
  const randomCount = totalQuestions - requiredQuestions.length;
  if (randomCount < 0) {
    warnings.push(`必考题数量(${requiredQuestions.length})超过总题数(${totalQuestions})，将只保留必考题`);
  }
  
  const typeEntries = Object.entries(config.typeCount || {});
  const totalTypeCount = typeEntries.reduce((sum, [_, count]) => sum + count, 0);
  const hasTypeConfig = totalTypeCount > 0;
  
  const diffRatio = config.difficultyRatio || { easy: 0.3, medium: 0.5, hard: 0.2, expert: 0 };
  
  const selectedRandom: Question[] = [];
  const usedIds = new Set<string>(requiredQuestions.map(q => q.id));
  
  const targetRandomCount = Math.max(0, randomCount);
  
  if (hasTypeConfig) {
    for (const [type, count] of typeEntries) {
      const typeQuestions = selectByDifficulty(
        pool, type, count, diffRatio, usedIds, config.knowledgeCoverage || 0,
        allKnowledgePointIds, selectedRandom
      );
      selectedRandom.push(...typeQuestions.selected);
      if (typeQuestions.warnings) {
        warnings.push(...typeQuestions.warnings);
      }
    }
  } else {
    const types = [...new Set(Object.keys(pool).map(k => k.split('_')[1]))];
    const perTypeCount = Math.ceil(targetRandomCount / types.length);
    
    for (const type of types) {
      if (selectedRandom.length >= targetRandomCount) break;
      
      const remaining = targetRandomCount - selectedRandom.length;
      const count = Math.min(perTypeCount, remaining);
      
      const typeQuestions = selectByDifficulty(
        pool, type, count, diffRatio, usedIds, config.knowledgeCoverage || 0,
        allKnowledgePointIds, selectedRandom
      );
      selectedRandom.push(...typeQuestions.selected);
      if (typeQuestions.warnings) {
        warnings.push(...typeQuestions.warnings);
      }
    }
  }
  
  const allSelected = [...requiredQuestions, ...selectedRandom];
  
  const shuffled = shuffleArray(allSelected);
  
  const examQuestions: ExamQuestion[] = shuffled.map((q, index) => ({
    id: generateId(),
    examId: '',
    questionId: q.id,
    sort: index,
    score: q.score,
    isRequired: requiredIds.includes(q.id),
    questionSnapshot: q
  }));
  
  const totalScore = examQuestions.reduce((sum, eq) => sum + eq.score, 0);
  
  const difficultyStats: { [key: string]: number } = {};
  const typeStats: { [key: string]: number } = {};
  
  for (const eq of examQuestions) {
    const q = eq.questionSnapshot;
    difficultyStats[q.difficulty] = (difficultyStats[q.difficulty] || 0) + 1;
    typeStats[q.type] = (typeStats[q.type] || 0) + 1;
  }
  
  const coverage = calculateKnowledgeCoverage(shuffled, allKnowledgePointIds);
  const requiredCoverage = config.knowledgeCoverage || 0;
  
  if (coverage < requiredCoverage) {
    warnings.push(`知识点覆盖率 ${coverage}% 低于目标 ${requiredCoverage}%`);
  }
  
  const actualCount = examQuestions.length;
  if (actualCount < totalQuestions) {
    warnings.push(`实际组卷 ${actualCount} 题，少于目标 ${totalQuestions} 题（题库不足）`);
  }
  
  return {
    success: true,
    questions: examQuestions,
    totalScore,
    difficultyStats,
    typeStats,
    knowledgeCoverage: coverage,
    requiredCoverage,
    warnings
  };
}

interface SelectionResult {
  selected: Question[];
  warnings: string[];
}

function selectByDifficulty(
  pool: QuestionPool,
  type: string,
  count: number,
  diffRatio: { [key: string]: number },
  usedIds: Set<string>,
  targetCoverage: number,
  allKpIds: string[],
  alreadySelected: Question[]
): SelectionResult {
  const warnings: string[] = [];
  const selected: Question[] = [];
  
  const difficulties = ['easy', 'medium', 'hard', 'expert'];
  const targetCounts: { [key: string]: number } = {};
  let remaining = count;
  
  for (let i = 0; i < difficulties.length; i++) {
    const diff = difficulties[i];
    const ratio = diffRatio[diff] || 0;
    
    if (i === difficulties.length - 1) {
      targetCounts[diff] = remaining;
    } else {
      const targetCount = Math.round(count * ratio);
      targetCounts[diff] = targetCount;
      remaining -= targetCount;
    }
  }
  
  for (const diff of difficulties) {
    const target = targetCounts[diff];
    if (target <= 0) continue;
    
    const key = getPoolKey(diff, type);
    const poolQuestions = pool[key] || [];
    const available = poolQuestions.filter(q => !usedIds.has(q.id));
    
    if (available.length < target) {
      warnings.push(`${diff}难度${type}题题库不足：需要${target}题，仅有${available.length}题`);
    }
    
    const picked = pickRandom(available, target);
    for (const q of picked) {
      selected.push(q);
      usedIds.add(q.id);
    }
  }
  
  const stillNeeded = count - selected.length;
  if (stillNeeded > 0) {
    for (const diff of difficulties) {
      if (selected.length >= count) break;
      
      const key = getPoolKey(diff, type);
      const poolQuestions = pool[key] || [];
      const available = poolQuestions.filter(q => !usedIds.has(q.id));
      
      const need = count - selected.length;
      const picked = pickRandom(available, need);
      
      for (const q of picked) {
        selected.push(q);
        usedIds.add(q.id);
      }
    }
  }
  
  if (targetCoverage > 0 && allKpIds.length > 0) {
    const allSelected = [...alreadySelected, ...selected];
    const currentCoverage = calculateKnowledgeCoverage(allSelected, allKpIds);
    
    if (currentCoverage < targetCoverage) {
      const optimized = optimizeKnowledgeCoverage(
        pool, type, selected, usedIds, targetCoverage, allKpIds, alreadySelected
      );
      
      if (optimized.improved) {
        selected.length = 0;
        selected.push(...optimized.questions);
      }
      
      if (optimized.warnings) {
        warnings.push(...optimized.warnings);
      }
    }
  }
  
  return { selected, warnings };
}

interface OptimizationResult {
  questions: Question[];
  improved: boolean;
  warnings: string[];
}

function optimizeKnowledgeCoverage(
  pool: QuestionPool,
  type: string,
  currentSelected: Question[],
  usedIds: Set<string>,
  targetCoverage: number,
  allKpIds: string[],
  alreadySelected: Question[]
): OptimizationResult {
  const warnings: string[] = [];
  const questions = [...currentSelected];
  
  let currentAll = [...alreadySelected, ...questions];
  let currentCoverage = calculateKnowledgeCoverage(currentAll, allKpIds);
  
  let improved = false;
  let iterations = 0;
  const maxIterations = 50;
  
  while (currentCoverage < targetCoverage && iterations < maxIterations) {
    iterations++;
    
    const coveredKps = new Set<string>();
    for (const q of currentAll) {
      for (const kpId of q.knowledgePointIds) {
        if (allKpIds.includes(kpId)) {
          coveredKps.add(kpId);
        }
      }
    }
    
    const uncoveredKps = allKpIds.filter(kp => !coveredKps.has(kp));
    if (uncoveredKps.length === 0) break;
    
    let bestSwap: { removeIndex: number; addQuestion: Question; gain: number } | null = null;
    
    for (const kpId of uncoveredKps) {
      for (const diff of ['easy', 'medium', 'hard', 'expert']) {
        const key = getPoolKey(diff, type);
        const poolQuestions = pool[key] || [];
        const candidates = poolQuestions.filter(
          q => !usedIds.has(q.id) && q.knowledgePointIds.includes(kpId)
        );
        
        for (const candidate of candidates) {
          for (let i = 0; i < questions.length; i++) {
            const toRemove = questions[i];
            if (toRemove.difficulty !== diff) continue;
            
            const newQuestions = [...questions];
            newQuestions[i] = candidate;
            const newAll = [...alreadySelected, ...newQuestions];
            const newCoverage = calculateKnowledgeCoverage(newAll, allKpIds);
            
            const gain = newCoverage - currentCoverage;
            
            if (gain > 0 && (!bestSwap || gain > bestSwap.gain)) {
              bestSwap = { removeIndex: i, addQuestion: candidate, gain };
            }
          }
        }
      }
    }
    
    if (!bestSwap) break;
    
    const removedId = questions[bestSwap.removeIndex].id;
    usedIds.delete(removedId);
    questions[bestSwap.removeIndex] = bestSwap.addQuestion;
    usedIds.add(bestSwap.addQuestion.id);
    
    improved = true;
    currentAll = [...alreadySelected, ...questions];
    currentCoverage = calculateKnowledgeCoverage(currentAll, allKpIds);
  }
  
  if (iterations >= maxIterations) {
    warnings.push('知识点覆盖率优化达到最大迭代次数');
  }
  
  return { questions, improved, warnings };
}

export function saveExamPaper(
  examId: string,
  examQuestions: ExamQuestion[]
): void {
  const db = getDb();
  
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(examId);
    
    const insert = db.prepare(`
      INSERT INTO exam_questions (
        id, exam_id, question_id, sort, score, is_required, question_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const eq of examQuestions) {
      insert.run(
        eq.id || generateId(),
        examId,
        eq.questionId,
        eq.sort,
        eq.score,
        eq.isRequired ? 1 : 0,
        JSON.stringify(eq.questionSnapshot)
      );
    }
  });
  
  transaction();
}

export function getExamQuestions(examId: string): ExamQuestion[] {
  const db = getDb();
  
  const rows = db.prepare(`
    SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY sort
  `).all(examId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    examId: row.exam_id,
    questionId: row.question_id,
    sort: row.sort,
    score: row.score,
    isRequired: !!row.is_required,
    questionSnapshot: row.question_snapshot ? JSON.parse(row.question_snapshot) : null
  }));
}
