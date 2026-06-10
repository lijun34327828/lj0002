import { Router, Response } from 'express';
import multer from 'multer';
import {
  getQuestions, getQuestionById, createQuestion, updateQuestion,
  deleteQuestion, checkDuplicateQuestions, bulkCreateQuestions,
  getSubjects, createSubject, getKnowledgePoints, createKnowledgePoint,
  getQuestionsByHash
} from '../services/questionService';
import { parseExcelFile, validateImportQuestions, generateTemplate } from '../services/importService';
import { authMiddleware, AuthRequest, roleMiddleware } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';
import type { QuestionType, DifficultyLevel, QuestionOption } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/subjects', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const subjects = getSubjects();
    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/subjects', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const subject = createSubject(name, description);
    res.json(subject);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/knowledge-points', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, parentId } = req.query;
    const points = getKnowledgePoints(
      subjectId as string,
      parentId !== undefined ? parentId as string : undefined
    );
    res.json(points);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/knowledge-points', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId, subjectId, level, sort } = req.body;
    const point = createKnowledgePoint({ name, parentId, subjectId, level, sort });
    res.json(point);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { subjectId, type, difficulty, status, keyword, page, pageSize, knowledgePointIds } = req.query;
    
    let kpIds: string[] | undefined;
    if (knowledgePointIds) {
      kpIds = Array.isArray(knowledgePointIds) 
        ? knowledgePointIds as string[]
        : (knowledgePointIds as string).split(',');
    }
    
    const result = getQuestions({
      subjectId: subjectId as string,
      type: type as QuestionType,
      difficulty: difficulty as DifficultyLevel,
      status: status as string,
      keyword: keyword as string,
      knowledgePointIds: kpIds,
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
    const question = getQuestionById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }
    
    res.json(question);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, roleMiddleware('admin', 'teacher'), idempotencyMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const {
      type, difficulty, subjectId, content, options,
      correctAnswer, analysis, score, knowledgePointIds
    } = req.body;
    
    if (!type || !difficulty || !subjectId || !content || !correctAnswer) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    const question = createQuestion({
      type: type as QuestionType,
      difficulty: difficulty as DifficultyLevel,
      subjectId,
      content,
      options: options as QuestionOption[],
      correctAnswer,
      analysis,
      score: score || 1,
      knowledgePointIds,
      creatorId: req.userId
    });
    
    res.status(201).json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const {
      type, difficulty, subjectId, content, options,
      correctAnswer, analysis, score, knowledgePointIds
    } = req.body;
    
    const question = updateQuestion(req.params.id, {
      type: type as QuestionType,
      difficulty: difficulty as DifficultyLevel,
      subjectId,
      content,
      options: options as QuestionOption[],
      correctAnswer,
      analysis,
      score,
      knowledgePointIds
    });
    
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }
    
    res.json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('admin', 'teacher'), (req: AuthRequest, res: Response) => {
  try {
    const success = deleteQuestion(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: '题目不存在' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check-duplicates', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { questions } = req.body;
    const duplicates = checkDuplicateQuestions(questions);
    res.json({ duplicates });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/import/template', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const buffer = generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=question_template.xlsx');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import/preview', authMiddleware, upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const questions = parseExcelFile(req.file.buffer);
    const validation = validateImportQuestions(questions);
    
    const duplicates = checkDuplicateQuestions(validation.valid);
    const dbDuplicates = duplicates.filter(d => d.existingQuestion !== null);
    
    res.json({
      total: questions.length,
      valid: validation.valid.length,
      invalid: validation.invalid.length,
      fileDuplicates: validation.duplicateCount,
      dbDuplicates: dbDuplicates.length,
      validQuestions: validation.valid,
      invalidQuestions: validation.invalid,
      dbDuplicateList: dbDuplicates
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/import', authMiddleware, roleMiddleware('admin', 'teacher'), idempotencyMiddleware, upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    
    const { subjectId, skipDuplicates = true } = req.body;
    
    if (!subjectId) {
      return res.status(400).json({ error: '请指定科目' });
    }
    
    const questions = parseExcelFile(req.file.buffer);
    const validation = validateImportQuestions(questions);
    
    const toImport = validation.valid.map(q => ({
      ...q,
      subjectId,
      knowledgePointIds: [] as string[]
    }));
    
    const result = bulkCreateQuestions(toImport);
    
    res.json({
      imported: result.created,
      skipped: result.skipped,
      invalid: validation.invalid.length,
      total: questions.length,
      questions: result.questions
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bulk', authMiddleware, roleMiddleware('admin', 'teacher'), idempotencyMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { questions } = req.body;
    
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: '题目列表不能为空' });
    }
    
    const result = bulkCreateQuestions(questions.map(q => ({
      ...q,
      creatorId: req.userId
    })));
    
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
