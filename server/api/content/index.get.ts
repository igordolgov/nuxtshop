// server/api/content/index.get.ts
// Редактируемый контент сайта (GET /api/content). Публичный: читает KV
// `data:content`; пустое хранилище отдаёт дефолты (mergeSiteContent).
// Ответ никогда не 500-ит из-за содержимого: битая/старая запись
// подменяется дефолтами на стороне contentHelpers.
import { readContent } from '../../lib/contentHelpers';

export default defineEventHandler(async (event) => {
  const content = await readContent(event);
  return { success: true, content };
});
