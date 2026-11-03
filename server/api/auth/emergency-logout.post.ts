// server/api/auth/emergency-logout.post.ts
import { destroySession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await destroySession(event);
  return { success: true, message: 'Сессия завершена' };
});
