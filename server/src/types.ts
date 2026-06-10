import { QUESTION_TYPES, DIFFICULTY_LEVELS, EXAM_STATUS, EXAM_ATTEMPT_STATUS, QUESTION_STATUS } from './config';

export type QuestionType = typeof QUESTION_TYPES[keyof typeof QUESTION_TYPES];
export type DifficultyLevel = typeof DIFFICULTY_LEVELS[keyof typeof DIFFICULTY_LEVELS];
export type ExamStatus = typeof EXAM_STATUS[keyof typeof EXAM_STATUS];
export type ExamAttemptStatus = typeof EXAM_ATTEMPT_STATUS[keyof typeof EXAM_ATTEMPT_STATUS];
export type QuestionStatus = typeof QUESTION_STATUS[keyof typeof QUESTION_STATUS];

export interface KnowledgePoint {
  id: string;
  name: string;
  parentId: string | null;
  subjectId: string;
  level: number;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  subjectId: string;
  knowledgePointIds: string[];
  content: string;
  options: QuestionOption[];
  correctAnswer: string;
  analysis: string;
  score: number;
  status: QuestionStatus;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  hash: string;
}

export interface Exam {
  id: string;
  name: string;
  description: string;
  subjectId: string;
  duration: number;
  totalScore: number;
  passScore: number;
  status: ExamStatus;
  startTime: string | null;
  endTime: string | null;
  allowBack: boolean;
  showScore: boolean;
  showAnswer: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  antiCheating: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  sort: number;
  score: number;
  isRequired: boolean;
  questionSnapshot: Question;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  userId: string;
  status: ExamAttemptStatus;
  startTime: string | null;
  endTime: string | null;
  durationUsed: number;
  totalScore: number;
  score: number;
  passed: boolean;
  cheatingCount: number;
  screenSwitchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  gradedAt: string | null;
  gradedBy: string | null;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  realName: string;
  role: 'admin' | 'teacher' | 'student';
  createdAt: string;
  updatedAt: string;
}

export interface ExamConfig {
  subjectId: string;
  knowledgePointIds?: string[];
  difficultyRatio: { easy: number; medium: number; hard: number; expert: number };
  typeCount: { [key: string]: number };
  totalQuestions: number;
  requiredQuestionIds: string[];
  totalScore: number;
  duration: number;
  knowledgeCoverage: number;
}

export interface WrongQuestion {
  id: string;
  userId: string;
  questionId: string;
  examAttemptId: string;
  userAnswer: string;
  correctAnswer: string;
  wrongCount: number;
  lastWrongTime: string;
}

export interface KnowledgeWeakness {
  userId: string;
  knowledgePointId: string;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
}
