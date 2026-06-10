import { Router, Response } from 'express';
import {
  createExam, getExamById, getExams, updateExam, deleteExam,
  startExam, saveAnswer, submitExam, getAttemptById,
  getUserAttempts, recordCheating, updateDurationUsed, getExamAnswers
} from '../services/examService';
import { generatePaper, getExamQuestions, saveExamPaper } from '../services/paperService';
import { authMiddleware, AuthRequest, roleMiddleware } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';
import type { ExamConfig } from '../types';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, status, keyword, page, pageSize } = req.query;
    const result = getExams({
      subjectId: subjectId as string,
      status: status as string,
      keyword: keyword as string,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const exam = getExamById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ error: '考试不存在' });
    }
    
    res.json(exam);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/questions', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const questions = getExamQuestions(req.params.id);
    
    if (req.userRole === 'student') {
      const maskedQuestions = questions.map(q => ({
        ...q,
        questionSnapshot: {
          ...q.questionSnapshot,
          correctAnswer: undefined,
          analysis: undefined,
          options: q.questionSnapshot?.options?.map(o => ({
            ...o,
            isCorrect: undefined
          }))
        }
      }));
      return res.json(maskedQuestions);
    }
    
    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, roleMiddleware('admin', 'teacher'), idempotencyMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const {
      name, description, subjectId, duration, passScore,
      startTime, endTime, allowBack, showScore, showAnswer,
      shuffleQuestions, shuffleOptions, antiCheating, config
    } = req.body;
    
    if (!name || !subjectId || !duration || !passScore) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    const result = createExam({
      name,
      description,
      subjectId,
      duration,
      totalScore: 0,
      passScore,
      startTime,
      endTime,
      allowBack,
      showScore,
      showAnswer,
      shuffleQuestions,
      shuffleOptions,
      antiCheating,
      creatorId: req.userId,
      config: config as ExamConfig
    });
    
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const exam = updateExam(req.params.id, req.body);
    
    if (!exam) {
      return res.status(404).json({ error: '考试不存在' });
    }
    
    res.json(exam);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('admin'), (req: AuthRequest, res: Response) => {
  try {
    const success = deleteExam(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: '考试不存在' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-paper', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const config = req.body as ExamConfig;
    const result = generatePaper(config);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/regenerate-paper', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const { config } = req.body;
    const result = generatePaper(config);
    
    saveExamPaper(req.params.id, result.questions);
    
    res.json({
      questions: result.questions,
      warnings: result.warnings
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:examId/start', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const result = startExam(req.params.examId, req.userId!);
    
    const maskedQuestions = result.questions.map(q => ({
      ...q,
      questionSnapshot: {
        ...q.questionSnapshot,
        correctAnswer: undefined,
        analysis: undefined,
        options: q.questionSnapshot?.options?.map(o => ({
          ...o,
          isCorrect: undefined
        }))
      }
    }));
    
    res.json({
      attempt: result.attempt,
      questions: maskedQuestions
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/answers/:attemptId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { questionId, answer } = req.body;
    
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt || attempt.userId !== req.userId) {
      return res.status(403).json({ error: '无权操作此考试' });
    }
    
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: '考试已结束' });
    }
    
    const savedAnswer = saveAnswer(req.params.attemptId, questionId, answer);
    res.json(savedAnswer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/answers/:attemptId/batch', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { answers } = req.body;
    
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt || attempt.userId !== req.userId) {
      return res.status(403).json({ error: '无权操作此考试' });
    }
    
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: '考试已结束' });
    }
    
    const savedAnswers = [];
    for (const item of answers) {
      const saved = saveAnswer(req.params.attemptId, item.questionId, item.answer);
      savedAnswers.push(saved);
    }
    
    res.json({ saved: savedAnswers.length, answers: savedAnswers });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/answers/:attemptId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt || attempt.userId !== req.userId) {
      return res.status(403).json({ error: '无权查看此考试答案' });
    }
    
    const answers = getExamAnswers(req.params.attemptId);
    res.json(answers);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:attemptId/submit', authMiddleware, idempotencyMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const result = submitExam(req.params.attemptId, req.userId!);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/attempts/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const attempt = getAttemptById(req.params.id);
    
    if (!attempt) {
      return res.status(404).json({ error: '考试记录不存在' });
    }
    
    if (attempt.userId !== req.userId && req.userRole === 'student') {
      return res.status(403).json({ error: '无权查看此考试记录' });
    }
    
    res.json(attempt);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/attempts/user/all', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { examId } = req.query;
    const attempts = getUserAttempts(req.userId!, examId as string);
    res.json(attempts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/anti-cheat/:attemptId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.body;
    
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt || attempt.userId !== req.userId) {
      return res.status(403).json({ error: '无权操作此考试' });
    }
    
    if (type === 'screen_switch' || type === 'cheating') {
      recordCheating(req.params.attemptId, type);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/duration/:attemptId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { duration } = req.body;
    
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt || attempt.userId !== req.userId) {
      return res.status(403).json({ error: '无权操作此考试' });
    }
    
    updateDurationUsed(req.params.attemptId, duration);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
