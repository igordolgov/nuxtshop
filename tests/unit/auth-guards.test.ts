// tests/unit/auth-guards.test.ts
// Гварды server/utils/auth.ts (requireUser/requireAdmin/requireStaff):
// 401 без сессии/по погашенной сессии/неактивному пользователю, 403 вне
// роли, проход для своей роли. h3.getCookie и хранилище мокируются —
// сессия подставляется напрямую, event — минимальный фейк.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>();
  return { ...actual, getCookie: vi.fn() };
});
vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(),
  kvPutJSON: vi.fn(),
  kvDelete: vi.fn(),
}));
vi.mock('../../server/lib/userHelpers', () => ({
  readUsers: vi.fn(),
}));

import { getCookie } from 'h3';
import { requireAdmin, requireStaff, requireUser } from '../../server/utils/auth';
import { kvGetJSON } from '../../server/lib/storage';
import { readUsers } from '../../server/lib/userHelpers';

const event = { context: {} } as never;

const makeUser = (role: 'user' | 'manager' | 'admin') => ({
  id: 'u1',
  email: 'staff@example.com',
  name: 'Staff',
  role,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

function stubSession(user: ReturnType<typeof makeUser> | null) {
  vi.mocked(getCookie).mockReturnValue(user ? 'token' : undefined);
  vi.mocked(kvGetJSON).mockResolvedValue(user ? ({ userId: user.id } as never) : null);
  vi.mocked(readUsers).mockResolvedValue((user ? [user] : []) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireUser', () => {
  it('без куки сессии — 401', async () => {
    stubSession(null);
    await expect(requireUser(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('сессия в KV не найдена (истекла/погашена) — 401', async () => {
    vi.mocked(getCookie).mockReturnValue('token');
    vi.mocked(kvGetJSON).mockResolvedValue(null);
    await expect(requireUser(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('неактивный пользователь — 401 (доступ отбирается мгновенно)', async () => {
    const user = { ...makeUser('manager'), isActive: false };
    vi.mocked(getCookie).mockReturnValue('token');
    vi.mocked(kvGetJSON).mockResolvedValue({ userId: user.id } as never);
    vi.mocked(readUsers).mockResolvedValue([user] as never);
    await expect(requireUser(event)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('requireStaff / requireAdmin по ролям', () => {
  const cases = [
    { role: 'user', guardName: 'requireStaff', guard: requireStaff, ok: false },
    { role: 'manager', guardName: 'requireStaff', guard: requireStaff, ok: true },
    { role: 'admin', guardName: 'requireStaff', guard: requireStaff, ok: true },
    { role: 'user', guardName: 'requireAdmin', guard: requireAdmin, ok: false },
    { role: 'manager', guardName: 'requireAdmin', guard: requireAdmin, ok: false },
    { role: 'admin', guardName: 'requireAdmin', guard: requireAdmin, ok: true },
  ] as const;

  it.each(cases)('$role: $guardName → $ok', async ({ role, guard, ok }) => {
    const user = makeUser(role);
    stubSession(user);
    if (ok) {
      await expect(guard(event)).resolves.toMatchObject({ id: user.id, role });
    } else {
      await expect(guard(event)).rejects.toMatchObject({ statusCode: 403 });
    }
  });
});
