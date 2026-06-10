import api from './api';
import type { Question, Subject, KnowledgePoint, QuestionType, DifficultyLevel, ListResult } from '../types';

export interface QuestionFilter {
  subjectId?: string;
  knowledgePointIds?: string[];
  type?: QuestionType;
  difficulty?: DifficultyLevel;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export async function getQuestions(filter: QuestionFilter): Promise<ListResult<Question>> {
  const params: Record<string, any> = {};
  
  if (filter.subjectId) params.subjectId = filter.subjectId;
  if (filter.type) params.type = filter.type;
  if (filter.difficulty) params.difficulty = filter.difficulty;
  if (filter.status) params.status = filter.status;
  if (filter.keyword) params.keyword = filter.keyword;
  if (filter.page) params.page = filter.page;
  if (filter.pageSize) params.pageSize = filter.pageSize;
  if (filter.knowledgePointIds?.length) {
    params.knowledgePointIds = filter.knowledgePointIds.join(',');
  }
  
  const response = await api.get<ListResult<Question>>('/questions', { params });
  return response.data;
}

export async function getQuestion(id: string): Promise<Question> {
  const response = await api.get<Question>(`/questions/${id}`);
  return response.data;
}

export async function createQuestion(data: Partial<Question>): Promise<Question> {
  const response = await api.post<Question>('/questions', data, {
    headers: { 'x-idempotency-key': `${Date.now()}-${Math.random()}` }
  });
  return response.data;
}

export async function updateQuestion(id: string, data: Partial<Question>): Promise<Question> {
  const response = await api.put<Question>(`/questions/${id}`, data);
  return response.data;
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const response = await api.delete(`/questions/${id}`);
  return response.data.success;
}

export async function getSubjects(): Promise<Subject[]> {
  const response = await api.get<Subject[]>('/questions/subjects');
  return response.data;
}

export async function createSubject(name: string, description?: string): Promise<Subject> {
  const response = await api.post<Subject>('/questions/subjects', { name, description });
  return response.data;
}

export async function getKnowledgePoints(subjectId?: string, parentId?: string): Promise<KnowledgePoint[]> {
  const params: Record<string, any> = {};
  if (subjectId) params.subjectId = subjectId;
  if (parentId !== undefined) params.parentId = parentId;
  
  const response = await api.get<KnowledgePoint[]>('/questions/knowledge-points', { params });
  return response.data;
}

export async function importQuestions(file: File, subjectId: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('subjectId', subjectId);
  
  const response = await api.post('/questions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

export async function previewImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/questions/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

export async function downloadTemplate(): Promise<Blob> {
  const response = await api.post('/questions/import/template', null, {
    responseType: 'blob'
  });
  return response.data;
}

export async function checkDuplicates(questions: any[]): Promise<any> {
  const response = await api.post('/questions/check-duplicates', { questions });
  return response.data;
}
