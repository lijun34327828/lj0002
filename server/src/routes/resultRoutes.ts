import { Router, Response } from 'express';
import {
  getWrongQuestions, getKnowledgeWeakness, getGradingTask,
  gradeSubjectiveQuestion, publishExamResults
} from '../services/gradingService';
import { getAttemptById } from '../services/examService';
import { authMiddleware, AuthRequest, roleMiddleware } from '../middleware/auth';

const router = Router();

router.get('/wrong-questions', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, page, pageSize } = req.query;
    const result = getWrongQuestions(req.userId!, {
      subjectId: subjectId as string,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/knowledge-weakness', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { subjectId } = req.query;
    const result = getKnowledgeWeakness(req.userId!, subjectId as string);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/grading-task/:taskId', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const task = getGradingTask(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: '判分任务不存在' });
    }
    
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/attempt/:attemptId/answers', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const attempt = getAttemptById(req.params.attemptId);
    
    if (!attempt) {
      return res.status(404).json({ error: '考试记录不存在' });
    }
    
    res.json(attempt);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/grade/:answerId', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const { score } = req.body;
    
    if (score === undefined || score === null) {
      return res.status(400).json({ error: '请输入分数' });
    }
    
    const result = gradeSubjectiveQuestion(req.params.answerId, Number(score), req.userId!);
    
    if (!result) {
      return res.status(404).json({ error: '答案不存在' });
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/publish/:attemptId', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const success = publishExamResults(req.params.attemptId);
    
    if (!success) {
      return res.status(400).json({ error: '发布失败，可能成绩尚未评出' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
