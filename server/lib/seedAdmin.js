// server/lib/seedAdmin.js
import { readUsers, writeUsers } from './userHelpers.js'
import { hashPassword } from './authHelpers.js'

// Конфигурация администратора по умолчанию
const DEFAULT_ADMIN = {
  email: 'admin@shop.ru',
  password: 'admin123', // Рекомендуется сменить после первого входа
  name: 'Администратор'
}

/**
 * Создаёт администратора по умолчанию
 * @returns {Promise<{created: boolean, email: string}>}
 */
export async function seedAdminUser() {
  try {
    const users = await readUsers()
    
    // Проверяем наличие админа
    const adminExists = users.some(u => u.role === 'admin')
    
    if (adminExists) {
      console.log('✅ Администратор уже существует')
      return { created: false, message: 'Администратор уже существует' }
    }
    
    console.log('👨‍💼 Создание администратора по умолчанию...')
    
    // Хэшируем пароль
    const hashedPassword = await hashPassword(DEFAULT_ADMIN.password)
    
    // Генерируем ID
    const newId = users.length > 0 
      ? String(Math.max(...users.map(u => Number(u.id) || 0)) + 1)
      : '1'
    
    const now = new Date().toISOString()
    
    const adminUser = {
      id: newId,
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      phone: '',
      address: '',
      avatar: '',
      isActive: true,
      emailVerified: true,
      lastLogin: null,
      createdAt: now,
      updatedAt: now
    }
    
    users.push(adminUser)
    await writeUsers(users)
    
    console.log('═══════════════════════════════════════════')
    console.log('✅ Администратор успешно создан!')
    console.log(`📧 Email: ${DEFAULT_ADMIN.email}`)
    console.log(`🔑 Пароль: ${DEFAULT_ADMIN.password}`)
    console.log('⚠️  Рекомендуется сменить пароль после входа!')
    console.log('═══════════════════════════════════════════')
    
    return { 
      created: true, 
      email: DEFAULT_ADMIN.email,
      message: 'Администратор создан'
    }
    
  } catch (error) {
    console.error('❌ Ошибка создания администратора:', error.message)
    return { 
      created: false, 
      error: error.message 
    }
  }
}

/**
 * Проверяет и создаёт администратора при необходимости
 * Используется при старте сервера
 */
export async function ensureAdminExists() {
  try {
    const users = await readUsers()
    const hasAdmin = users.some(u => u.role === 'admin' && u.isActive !== false)
    
    if (!hasAdmin) {
      console.log('⚠️ Активный администратор не найден, создаём...')
      return await seedAdminUser()
    }
    
    return { created: false, message: 'Администратор существует' }
    
  } catch (error) {
    console.error('❌ Ошибка проверки администратора:', error.message)
    return { created: false, error: error.message }
  }
}

/**
 * Сбрасывает пароль администратора
 * @param {string} newPassword - Новый пароль
 */
export async function resetAdminPassword(newPassword) {
  try {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Пароль должен содержать минимум 6 символов')
    }
    
    const users = await readUsers()
    const adminIndex = users.findIndex(u => u.role === 'admin')
    
    if (adminIndex === -1) {
      throw new Error('Администратор не найден')
    }
    
    users[adminIndex].password = await hashPassword(newPassword)
    users[adminIndex].updatedAt = new Date().toISOString()
    
    await writeUsers(users)
    
    console.log('✅ Пароль администратора изменён')
    return { success: true, message: 'Пароль изменён' }
    
  } catch (error) {
    console.error('❌ Ошибка сброса пароля:', error.message)
    return { success: false, error: error.message }
  }
}