import api from './api';
import type { WrongQuestion, KnowledgeWeakness } from '../types';

export async function getWrongQuestions(filter?: {
  subjectId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ list: WrongQuestion[]; total: number }> {
  const response = await api.get('/results/wrong-questions', { params: filter });
  return response.data;
}

export async function getKnowledgeWeakness(subjectId?: string): Promise<KnowledgeWeakness[]> {
  const response = await api.get<KnowledgeWeakness[]>('/results/knowledge-weakness', {
    params: subjectId ? { subjectId } : {}
  });
  return response.data;
}

export async function getGradingTask(taskId: string): Promise<any> {
  const response = await api.get(`/results/grading-task/${taskId}`);
  return response.data;
}

export async function gradeSubjectiveQuestion(answerId: string, score: number): Promise<any> {
  const response = await api.post(`/results/grade/${answerId}`, { score });
  return response.data;
}

export async function publishResult(attemptId: string): Promise<boolean> {
  const response = await api.post(`/results/publish/${attemptId}`);
  return response.data.success;
}
