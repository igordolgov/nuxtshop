// server/lib/authHelpers.js
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SALT_ROUNDS = 12

/**
 * Хэширует пароль с использованием bcrypt
 * @param {string} password - Пароль в открытом виде
 * @returns {Promise<string>} - Хэшированный пароль
 */
export const hashPassword = async (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Пароль обязателен и должен быть строкой')
  }
  
  if (password.length < 6) {
    throw new Error('Пароль должен содержать минимум 6 символов')
  }
  
  try {
    return await bcrypt.hash(password, SALT_ROUNDS)
  } catch (error) {
    console.error('❌ Ошибка хэширования пароля:', error.message)
    throw new Error('Ошибка при хэшировании пароля')
  }
}

/**
 * Сравнивает пароль с хэшем
 * @param {string} password - Пароль в открытом виде
 * @param {string} hash - Хэшированный пароль из БД
 * @returns {Promise<boolean>} - true если пароль верный
 */
export const comparePassword = async (password, hash) => {
  if (!password || !hash) {
    return false
  }
  
  try {
    return await bcrypt.compare(password, hash)
  } catch (error) {
    console.error('❌ Ошибка сравнения пароля:', error.message)
    return false
  }
}

/**
 * Проверяет, является ли строка валидным bcrypt хэшем
 * @param {string} str - Строка для проверки
 * @returns {boolean}
 */
export const isBcryptHash = (str) => {
  if (!str || typeof str !== 'string') return false
  // bcrypt хэш начинается с $2a$, $2b$ или $2y$   return /^\$2[aby]\$\d{2}\$.{53}$/.test(str)
}

/**
 * Генерирует безопасный случайный токен
 * @param {number} length - Длина токена в байтах
 * @returns {string} - Hex строка
 */
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex')
}