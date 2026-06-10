import api from './api';
import type { User } from '../types';

export interface LoginResult {
  token: string;
  user: User;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await api.post<LoginResult>('/auth/login', { username, password });
  return response.data;
}

export async function register(data: {
  username: string;
  password: string;
  email?: string;
  realName?: string;
}): Promise<LoginResult> {
  const response = await api.post<LoginResult>('/auth/register', data);
  return response.data;
}

export async function getProfile(): Promise<User> {
  const response = await api.get<User>('/auth/profile');
  return response.data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  const response = await api.put('/auth/password', { oldPassword, newPassword });
  return response.data.success;
}
