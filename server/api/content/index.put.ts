// server/api/content/index.put.ts
// Сохранение контента сайта (PUT /api/content). Только админ.
// Валидация в sanitizeSiteContent (shared/siteContent — общая с GET,
// покрыта тестами): кидает ContentValidationError с сообщением на
// русском → отдаём как 400.
import { ContentValidationError, sanitizeSiteContent, writeContent } from '../../lib/contentHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)
    const clean = sanitizeSiteContent(body ?? {})
    await writeContent(event, clean)

    return { success: true, content: clean, message: 'Контент сохранён' }
  } catch (error) {
    if (error instanceof ContentValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Ошибка сохранения контента:', error)
    throw createError({ statusCode: 500, message: 'Не удалось сохранить контент' })
  }
})
