// server/api/auth/logout.post.ts
import { destroySession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await destroySession(event);
  return { success: true, message: 'Выход выполнен успешно' };
});
