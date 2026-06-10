import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { Question, QuestionOption } from '../types';

export function generateId(): string {
  return uuidv4();
}

export function now(): string {
  return new Date().toISOString();
}

export function hashQuestion(question: {
  type: string;
  content: string;
  options?: Array<{ label: string; content: string; isCorrect?: boolean }>;
  correctAnswer: string;
}): string {
  const optionsStr = question.options
    ?.sort((a, b) => a.label.localeCompare(b.label))
    .map(o => `${o.label}:${o.content}`)
    .join('|') || '';
  
  const content = `${question.type}:${question.content}:${optionsStr}:${question.correctAnswer}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    config.jwtSecret as any,
    { expiresIn: config.jwtExpiresIn } as any
  );
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
  } catch {
    return null;
  }
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function pickRandom<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

export function parseExcelDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;
  const hours = Math.floor(totalSeconds / (60 * 60));
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), hours, minutes, seconds);
}

export function calculateKnowledgeWeakness(
  questions: { knowledgePointIds: string[]; isCorrect: boolean | null }[]
): Map<string, { total: number; correct: number }> {
  const stats = new Map<string, { total: number; correct: number }>();
  
  for (const q of questions) {
    for (const kpId of q.knowledgePointIds) {
      if (!stats.has(kpId)) {
        stats.set(kpId, { total: 0, correct: 0 });
      }
      const stat = stats.get(kpId)!;
      stat.total++;
      if (q.isCorrect) stat.correct++;
    }
  }
  
  return stats;
}
