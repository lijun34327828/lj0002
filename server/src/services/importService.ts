import * as XLSX from 'xlsx';
import { hashQuestion } from '../utils';
import type { QuestionType, DifficultyLevel, QuestionOption } from '../types';

export interface ImportedQuestion {
  type: QuestionType;
  difficulty: DifficultyLevel;
  content: string;
  options?: QuestionOption[];
  correctAnswer: string;
  analysis?: string;
  score: number;
  knowledgePointNames?: string[];
  error?: string;
}

const TYPE_MAP: { [key: string]: QuestionType } = {
  '单选题': 'single_choice',
  'single_choice': 'single_choice',
  'single': 'single_choice',
  '多选题': 'multiple_choice',
  'multiple_choice': 'multiple_choice',
  'multiple': 'multiple_choice',
  '判断题': 'true_false',
  'true_false': 'true_false',
  'judge': 'true_false',
  '填空题': 'fill_blank',
  'fill_blank': 'fill_blank',
  'fill': 'fill_blank',
  '简答题': 'short_answer',
  'short_answer': 'short_answer',
  'short': 'short_answer',
  '问答题': 'essay',
  'essay': 'essay',
  '论述题': 'essay'
};

const DIFFICULTY_MAP: { [key: string]: DifficultyLevel } = {
  '简单': 'easy',
  '易': 'easy',
  'easy': 'easy',
  '中等': 'medium',
  '中': 'medium',
  'medium': 'medium',
  '困难': 'hard',
  '难': 'hard',
  'hard': 'hard',
  '专家': 'expert',
  'expert': 'expert'
};

export function parseExcelFile(fileBuffer: Buffer): ImportedQuestion[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
  
  if (jsonData.length < 2) {
    return [];
  }
  
  const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
  const questions: ImportedQuestion[] = [];
  
  const typeIndex = findColumnIndex(headers, ['题型', '类型', 'type', 'question_type']);
  const difficultyIndex = findColumnIndex(headers, ['难度', 'difficulty', 'level']);
  const contentIndex = findColumnIndex(headers, ['题目', '题干', '内容', 'content', 'question']);
  const optionAIndex = findColumnIndex(headers, ['a', '选项a', 'option_a', 'optiona']);
  const optionBIndex = findColumnIndex(headers, ['b', '选项b', 'option_b', 'optionb']);
  const optionCIndex = findColumnIndex(headers, ['c', '选项c', 'option_c', 'optionc']);
  const optionDIndex = findColumnIndex(headers, ['d', '选项d', 'option_d', 'optiond']);
  const optionEIndex = findColumnIndex(headers, ['e', '选项e', 'option_e', 'optione']);
  const answerIndex = findColumnIndex(headers, ['答案', '正确答案', 'answer', 'correct_answer']);
  const analysisIndex = findColumnIndex(headers, ['解析', '分析', '解释', 'analysis', 'explanation']);
  const scoreIndex = findColumnIndex(headers, ['分值', '分数', 'score', 'points']);
  const knowledgeIndex = findColumnIndex(headers, ['知识点', '考点', 'knowledge', 'knowledge_point']);
  
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    
    if (!row || row.length === 0 || !row[contentIndex]) {
      continue;
    }
    
    const question = parseQuestionRow(
      row, typeIndex, difficultyIndex, contentIndex,
      optionAIndex, optionBIndex, optionCIndex, optionDIndex, optionEIndex,
      answerIndex, analysisIndex, scoreIndex, knowledgeIndex
    );
    
    questions.push(question);
  }
  
  return questions;
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (possibleNames.some(name => {
      if (name.length <= 1) {
        return header === name;
      }
      return header === name || header.includes(name);
    })) {
      return i;
    }
  }
  return -1;
}

function parseQuestionRow(
  row: any[],
  typeIndex: number,
  difficultyIndex: number,
  contentIndex: number,
  optionAIndex: number,
  optionBIndex: number,
  optionCIndex: number,
  optionDIndex: number,
  optionEIndex: number,
  answerIndex: number,
  analysisIndex: number,
  scoreIndex: number,
  knowledgeIndex: number
): ImportedQuestion {
  const errors: string[] = [];
  
  const typeStr = typeIndex >= 0 ? String(row[typeIndex] || '').trim() : '';
  const type = TYPE_MAP[typeStr] || 'single_choice';
  
  const difficultyStr = difficultyIndex >= 0 ? String(row[difficultyIndex] || '').trim() : '';
  const difficulty = DIFFICULTY_MAP[difficultyStr] || 'medium';
  
  const content = contentIndex >= 0 ? String(row[contentIndex] || '').trim() : '';
  if (!content) {
    errors.push('题目内容不能为空');
  }
  
  const options: QuestionOption[] = [];
  const optionLabels = ['A', 'B', 'C', 'D', 'E'];
  const optionIndices = [optionAIndex, optionBIndex, optionCIndex, optionDIndex, optionEIndex];
  
  for (let i = 0; i < optionIndices.length; i++) {
    if (optionIndices[i] >= 0 && row[optionIndices[i]]) {
      options.push({
        id: '',
        label: optionLabels[i],
        content: String(row[optionIndices[i]]).trim(),
        isCorrect: false
      });
    }
  }
  
  let correctAnswer = answerIndex >= 0 ? String(row[answerIndex] || '').trim() : '';
  const analysis = analysisIndex >= 0 ? String(row[analysisIndex] || '').trim() : '';
  const score = scoreIndex >= 0 ? Number(row[scoreIndex]) || 1 : 1;
  
  let knowledgePointNames: string[] | undefined;
  if (knowledgeIndex >= 0 && row[knowledgeIndex]) {
    knowledgePointNames = String(row[knowledgeIndex])
      .split(/[,，;；、]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  if (type === 'single_choice' || type === 'multiple_choice') {
    if (options.length < 2) {
      errors.push('选择题至少需要2个选项');
    }
    
    if (!correctAnswer) {
      errors.push('选择题必须有正确答案');
    } else {
      const answerOptions = correctAnswer.toUpperCase().split(/[,，]/).map(s => s.trim());
      options.forEach(opt => {
        opt.isCorrect = answerOptions.includes(opt.label);
      });
    }
  }
  
  if (type === 'true_false') {
    if (!correctAnswer) {
      errors.push('判断题必须有正确答案');
    } else {
      const answer = correctAnswer.toLowerCase();
      if (['对', '正确', 'true', '√', 'yes', 'y', 't'].includes(answer)) {
        correctAnswer = 'true';
      } else if (['错', '错误', 'false', '×', 'no', 'n', 'f'].includes(answer)) {
        correctAnswer = 'false';
      }
    }
  }
  
  const question: ImportedQuestion = {
    type,
    difficulty,
    content,
    options: options.length > 0 ? options : undefined,
    correctAnswer,
    analysis,
    score,
    knowledgePointNames
  };
  
  if (errors.length > 0) {
    question.error = errors.join('; ');
  }
  
  return question;
}

export function validateImportQuestions(questions: ImportedQuestion[]): {
  valid: ImportedQuestion[];
  invalid: ImportedQuestion[];
  duplicateCount: number;
} {
  const valid: ImportedQuestion[] = [];
  const invalid: ImportedQuestion[] = [];
  const seenHashes = new Set<string>();
  let duplicateCount = 0;
  
  for (const q of questions) {
    if (q.error) {
      invalid.push(q);
      continue;
    }
    
    const hash = hashQuestion({
      type: q.type,
      content: q.content,
      options: q.options,
      correctAnswer: q.correctAnswer
    });
    
    if (seenHashes.has(hash)) {
      duplicateCount++;
      q.error = '导入文件内重复';
      invalid.push(q);
    } else {
      seenHashes.add(hash);
      valid.push(q);
    }
  }
  
  return { valid, invalid, duplicateCount };
}

export function generateTemplate(): Buffer {
  const data = [
    ['题型', '难度', '题目', 'A', 'B', 'C', 'D', '正确答案', '解析', '分值', '知识点'],
    ['单选题', '简单', '以下哪个是JavaScript的数据类型？', 'String', 'Integer', 'Float', 'Double', 'A', 'String是JavaScript的基本数据类型', 2, 'JavaScript基础;数据类型'],
    ['多选题', '中等', '以下哪些是前端框架？', 'React', 'Vue', 'Django', 'Angular', 'A,B,D', 'React、Vue、Angular都是前端框架', 3, '前端框架'],
    ['判断题', '简单', 'HTML是一种编程语言。', '', '', '', '', '错', 'HTML是标记语言，不是编程语言', 1, 'HTML基础'],
    ['填空题', '中等', 'CSS的全称是______。', '', '', '', '', 'Cascading Style Sheets', '层叠样式表', 2, 'CSS基础'],
    ['简答题', '困难', '请简述React的虚拟DOM原理。', '', '', '', '', '', '虚拟DOM是轻量级的JavaScript对象...', 5, 'React原理;虚拟DOM']
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '题目');
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
