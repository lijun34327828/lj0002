import { getDb } from '../db';
import { generateId, now, hashPassword, comparePassword, generateToken } from '../utils';
import type { User } from '../types';

export interface RegisterData {
  username: string;
  email?: string;
  password: string;
  realName?: string;
  role?: 'admin' | 'teacher' | 'student';
}

export interface LoginResult {
  token: string;
  user: Omit<User, 'password'>;
}

export function register(data: RegisterData): LoginResult {
  const db = getDb();
  
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username);
  if (existing) {
    throw new Error('用户名已存在');
  }
  
  const id = generateId();
  const currentTime = now();
  const hashedPassword = hashPassword(data.password);
  
  db.prepare(`
    INSERT INTO users (id, username, email, password, real_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.username, data.email || '', hashedPassword,
    data.realName || '', data.role || 'student', currentTime, currentTime
  );
  
  const user = getUserById(id)!;
  const token = generateToken(id, user.role);
  
  return {
    token,
    user: omitPassword(user)
  };
}

export function login(username: string, password: string): LoginResult {
  const db = getDb();
  
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  
  if (!row) {
    throw new Error('用户名或密码错误');
  }
  
  if (!comparePassword(password, row.password)) {
    throw new Error('用户名或密码错误');
  }
  
  const user = rowToUser(row);
  const token = generateToken(user.id, user.role);
  
  return {
    token,
    user: omitPassword(user)
  };
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  return row ? rowToUser(row) : null;
}

export function getUserProfile(id: string): Omit<User, 'password'> | null {
  const user = getUserById(id);
  return user ? omitPassword(user) : null;
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password: row.password,
    realName: row.real_name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function omitPassword(user: User): Omit<User, 'password'> {
  const { password, ...rest } = user;
  return rest;
}

export function changePassword(userId: string, oldPassword: string, newPassword: string): boolean {
  const db = getDb();
  
  const row = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as any;
  
  if (!row || !comparePassword(oldPassword, row.password)) {
    throw new Error('原密码错误');
  }
  
  const result = db.prepare(`
    UPDATE users SET password = ?, updated_at = ? WHERE id = ?
  `).run(hashPassword(newPassword), now(), userId);
  
  return result.changes > 0;
}

export function getUsers(filter?: {
  role?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): { list: Omit<User, 'password'>[]; total: number } {
  const db = getDb();
  const page = filter?.page || 1;
  const pageSize = filter?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  const whereClauses: string[] = [];
  const params: any[] = [];
  
  if (filter?.role) {
    whereClauses.push('role = ?');
    params.push(filter.role);
  }
  
  if (filter?.keyword) {
    whereClauses.push('(username LIKE ? OR real_name LIKE ? OR email LIKE ?)');
    params.push(`%${filter.keyword}%`, `%${filter.keyword}%`, `%${filter.keyword}%`);
  }
  
  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  const totalRow = db.prepare(`
    SELECT COUNT(*) as count FROM users ${whereSql}
  `).get(...params) as { count: number };
  
  const rows = db.prepare(`
    SELECT * FROM users ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[];
  
  return {
    list: rows.map(row => omitPassword(rowToUser(row))),
    total: totalRow.count
  };
}
