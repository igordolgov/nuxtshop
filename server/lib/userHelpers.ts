// server/lib/userHelpers.ts
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import usersSeed from '../data/users.json';

const USERS_KEY = 'data:users';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'user' | 'manager' | 'admin';
  phone: string;
  address: string;
  avatar?: string;
  isActive: boolean;
  emailVerified?: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function readUsers(event: H3Event): Promise<User[]> {
  const stored = await kvGetJSON<User[]>(event, USERS_KEY);
  if (stored) return stored;
  const seed = (Array.isArray(usersSeed) ? usersSeed : []) as User[];
  await kvPutJSON(event, USERS_KEY, seed);
  return seed;
}

export async function writeUsers(event: H3Event, users: User[]) {
  if (!Array.isArray(users)) throw new Error('Users must be an array');
  await kvPutJSON(event, USERS_KEY, users);
}

export function stripPassword<T extends { password?: string }>(user: T) {
  const { password: _p, ...safe } = user;
  return safe;
}

export async function getUserByEmail(event: H3Event, email: string): Promise<User | null> {
  const users = await readUsers(event);
  const e = email?.toLowerCase();
  return users.find((u) => u.email?.toLowerCase() === e) ?? null;
}

export async function createUser(
  event: H3Event,
  data: { name: string; email: string; password: string },
): Promise<User> {
  const users = await readUsers(event);
  if (users.some((u) => u.email?.toLowerCase() === data.email.toLowerCase())) {
    throw new Error('Пользователь с таким email уже существует');
  }
  const now = new Date().toISOString();
  const user: User = {
    id: Date.now().toString(),
    name: data.name,
    email: data.email.toLowerCase(),
    password: data.password,
    role: 'user',
    phone: '',
    address: '',
    avatar: '',
    isActive: true,
    emailVerified: false,
    lastLogin: null,
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);
  await writeUsers(event, users);
  return user;
}
