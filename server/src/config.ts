export const config = {
  port: 8632,
  dbPath: './data/exam.db',
  jwtSecret: 'exam-platform-secret-key-2024',
  jwtExpiresIn: '24h',
  uploadDir: './uploads',
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 1000
  }
};

export const QUESTION_TYPES = {
  SINGLE_CHOICE: 'single_choice',
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  FILL_BLANK: 'fill_blank',
  SHORT_ANSWER: 'short_answer',
  ESSAY: 'essay'
} as const;

export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert'
} as const;

export const EXAM_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ONGOING: 'ongoing',
  FINISHED: 'finished',
  ARCHIVED: 'archived'
} as const;

export const EXAM_ATTEMPT_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  GRADED: 'graded',
  REVIEWING: 'reviewing',
  PUBLISHED: 'published'
} as const;

export const QUESTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;
