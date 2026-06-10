export interface User {
  id: string;
  username: string;
  email: string;
  realName: string;
  role: 'admin' | 'teacher' | 'student';
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  content: string;
  isCorrect?: boolean;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'essay';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';
export type ExamStatus = 'draft' | 'published' | 'ongoing' | 'finished' | 'archived';
export type ExamAttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'reviewing' | 'published';

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  subjectId: string;
  knowledgePointIds: string[];
  content: string;
  options: QuestionOption[];
  correctAnswer?: string;
  analysis?: string;
  score: number;
  status: string;
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
  score: number | null;
  passed: boolean | null;
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

export interface WrongQuestion {
  id: string;
  userId: string;
  questionId: string;
  examAttemptId: string;
  userAnswer: string;
  correctAnswer: string;
  wrongCount: number;
  lastWrongTime: string;
  type?: string;
  difficulty?: string;
  content?: string;
}

export interface KnowledgeWeakness {
  knowledgePointId: string;
  knowledgePointName: string;
  parentId: string | null;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
}

export interface ListResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
