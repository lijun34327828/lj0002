import api, { generateIdempotencyKey } from './api';
import type { Exam, ExamQuestion, ExamAttempt, ExamAnswer, ExamConfig, PaperGenerationResult, ListResult } from '../types';

export async function getExams(filter?: {
  subjectId?: string;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResult<Exam>> {
  const response = await api.get<ListResult<Exam>>('/exams', { params: filter });
  return response.data;
}

export async function getExam(id: string): Promise<Exam> {
  const response = await api.get<Exam>(`/exams/${id}`);
  return response.data;
}

export async function getExamQuestions(examId: string): Promise<ExamQuestion[]> {
  const response = await api.get<ExamQuestion[]>(`/exams/${examId}/questions`);
  return response.data;
}

export async function createExam(data: {
  name: string;
  description?: string;
  subjectId: string;
  duration: number;
  passScore: number;
  config: ExamConfig;
}): Promise<{ exam: Exam; questions: ExamQuestion[]; warnings: string[] }> {
  const response = await api.post('/exams', data, {
    headers: { 'x-idempotency-key': generateIdempotencyKey() }
  });
  return response.data;
}

export async function updateExam(id: string, data: Partial<Exam>): Promise<Exam> {
  const response = await api.put<Exam>(`/exams/${id}`, data);
  return response.data;
}

export async function deleteExam(id: string): Promise<boolean> {
  const response = await api.delete(`/exams/${id}`);
  return response.data.success;
}

export async function generatePaper(config: ExamConfig): Promise<PaperGenerationResult> {
  const response = await api.post<PaperGenerationResult>('/exams/generate-paper', config);
  return response.data;
}

export async function startExam(examId: string): Promise<{
  attempt: ExamAttempt;
  questions: ExamQuestion[];
}> {
  const response = await api.post(`/exams/${examId}/start`, {});
  return response.data;
}

export async function saveAnswer(attemptId: string, questionId: string, answer: string): Promise<ExamAnswer> {
  const response = await api.post<ExamAnswer>(`/exams/answers/${attemptId}`, { questionId, answer });
  return response.data;
}

export async function saveAnswersBatch(attemptId: string, answers: Array<{ questionId: string; answer: string }>): Promise<any> {
  const response = await api.post(`/exams/answers/${attemptId}/batch`, { answers });
  return response.data;
}

export async function getExamAnswers(attemptId: string): Promise<ExamAnswer[]> {
  const response = await api.get<ExamAnswer[]>(`/exams/answers/${attemptId}`);
  return response.data;
}

export async function submitExam(attemptId: string): Promise<{
  attempt: ExamAttempt;
  gradingTaskId: string;
}> {
  const response = await api.post(`/exams/${attemptId}/submit`, {}, {
    headers: { 'x-idempotency-key': generateIdempotencyKey() }
  });
  return response.data;
}

export async function getAttempt(attemptId: string): Promise<ExamAttempt> {
  const response = await api.get<ExamAttempt>(`/exams/attempts/${attemptId}`);
  return response.data;
}

export async function getUserAttempts(examId?: string): Promise<ExamAttempt[]> {
  const params = examId ? { examId } : {};
  const response = await api.get<ExamAttempt[]>('/exams/attempts/user/all', { params });
  return response.data;
}

export async function recordAntiCheat(attemptId: string, type: 'screen_switch' | 'cheating'): Promise<void> {
  await api.post(`/exams/anti-cheat/${attemptId}`, { type });
}

export async function updateDuration(attemptId: string, duration: number): Promise<void> {
  await api.post(`/exams/duration/${attemptId}`, { duration });
}
