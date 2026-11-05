// shared/messengerLinks.ts
/**
 * Глубокие ссылки на мессенджеры из карточки «Контакты» (админка → Контент).
 *
 * В контенте мессенджер хранится как { name, handle }: name — «Telegram»,
 * «WhatsApp», «VK», «Viber»…, handle — ник, телефон или ссылка в любом
 * разумном формате («@nuxtshop», «t.me/nuxtshop», «+7 800 555-35-35»,
 * «vk.com/nuxtshop»). messengerLink() превращает пару в рабочую ссылку,
 * которая открывает приложение мессенджера на телефоне и web-версию
 * на десктопе. Вернула null — связка не распознана: UI показывает
 * только копирование ника (прежнее поведение).
 *
 * Чистая функция без зависимостей — покрыта юнит-тестами.
 */

const TG_USERNAME_RE = /^[A-Za-z0-9_]{4,64}$/;
const VK_USERNAME_RE = /^[A-Za-z0-9_.-]{2,64}$/;

/** Только цифры («+7 800 555-35-35» → «78005553535»). */
function digits(value: string): string {
  return value.replace(/\D+/g, '');
}

/** Ссылка уже готова — не трогаем (админ вписал полный URL). */
function isFullUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Телефон для wa.me/tel:: убираем всё нецифровое, короткий внутренний
 * «8…» (11 цифр) заменяем международным «7…».
 */
function normalizePhone(handle: string): string | null {
  let d = digits(handle);
  if (d.length === 11 && d.startsWith('8')) d = `7${d.slice(1)}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function messengerLink(name: string, handle: string): string | null {
  const link = typeof handle === 'string' ? handle.trim() : '';
  if (!link || link.length > 200) return null;
  if (isFullUrl(link)) return link;

  const brand = String(name ?? '').toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => brand.includes(n));

  // Telegram: @username, username, t.me/username, telegram.me/username
  if (has('telegram', 'tg')) {
    const tme = link.match(/^(?:www\.)?(?:t\.me|telegram\.me)\/(.+)$/i);
    const captured = tme?.[1];
    if (captured !== undefined) return `https://t.me/${captured.replace(/^@/, '')}`;
    const nick = link.replace(/^@/, '');
    if (TG_USERNAME_RE.test(nick)) return `https://t.me/${nick}`;
    return null;
  }

  // WhatsApp: телефон → https://wa.me/<цифры>
  if (has('whats') || brand.trim() === 'wa') {
    const phone = normalizePhone(link);
    return phone ? `https://wa.me/${phone}` : null;
  }

  // Viber: телефон → viber://chat?number=%2B… (+ кодируем как «%2B»)
  if (has('viber')) {
    const phone = normalizePhone(link);
    return phone ? `viber://chat?number=%2B${phone}` : null;
  }

  // VK: vk.com/xxx, @xxx, «xxx»
  if (has('vk', 'вконтакт', 'вк')) {
    const path = link.match(/^(?:www\.)?(?:vk\.com|m\.vk\.com|vk\.ru)\/(.+)$/i);
    const captured = path?.[1];
    const nick = captured ?? link.replace(/^@/, '');
    return VK_USERNAME_RE.test(nick) ? `https://vk.com/${nick}` : null;
  }

  // Нераспознанный мессенджер: телефон → tel:, иначе не выдумываем формат
  const phone = normalizePhone(link);
  if (phone) return `tel:+${phone}`;
  return null;
}
