// server/lib/userHelpers.js
import fs from 'fs/promises'
import path from 'path'
import { getCookie } from 'h3'

const usersFilePath = path.join(process.cwd(), 'server', 'data', 'users.json')

let usersCache = null
let cacheTimestamp = null
const CACHE_TTL = 5000

export function invalidateUsersCache() {
  usersCache = null
  cacheTimestamp = null
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function readUsers(forceRefresh) {
  const now = Date.now()
  
  if (!forceRefresh && usersCache && cacheTimestamp && (now - cacheTimestamp < CACHE_TTL)) {
    return usersCache
  }
  
  try {
    if (!(await fileExists(usersFilePath))) {
      console.warn('⚠️ Файл users.json не найден')
      return []
    }
    
    const data = await fs.readFile(usersFilePath, 'utf8')
    
    if (!data || !data.trim()) {
      return []
    }
    
    const users = JSON.parse(data)
    
    if (!Array.isArray(users)) {
      console.error('❌ users.json должен содержать массив')
      return []
    }
    
    usersCache = users
    cacheTimestamp = now
    
    return users
    
  } catch (error) {
    console.error('❌ Ошибка чтения users.json:', error.message)
    return usersCache || []
  }
}

export async function writeUsers(users) {
  if (!Array.isArray(users)) {
    throw new Error('Users must be an array')
  }
  
  try {
    await fs.mkdir(path.dirname(usersFilePath), { recursive: true })
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2))
    
    usersCache = users
    cacheTimestamp = Date.now()
    
    return true
    
  } catch (error) {
    console.error('❌ Ошибка записи users.json:', error.message)
    throw error
  }
}

export async function getUserFromSession(event) {
  try {
    const userSession = getCookie(event, 'user_session')
    
    if (userSession) {
      try {
        const sessionData = JSON.parse(userSession)
        const users = await readUsers()
        return users.find(u => u.id === sessionData?.user?.id && u.isActive !== false) || null
      } catch {
        return null
      }
    }
    
    return null
    
  } catch (error) {
    console.error('❌ Ошибка получения сессии:', error.message)
    return null
  }
}

export async function getUserById(id) {
  const users = await readUsers()
  return users.find(u => String(u.id) === String(id)) || null
}

export async function getUserByEmail(email) {
  const users = await readUsers()
  const emailLower = email?.toLowerCase()
  return users.find(u => u.email?.toLowerCase() === emailLower) || null
}

export async function updateUserRole(userId, newRole) {
  const validRoles = ['user', 'admin', 'manager', 'editor']
  
  if (!validRoles.includes(newRole)) {
    throw new Error('Недопустимая роль: ' + newRole)
  }
  
  const users = await readUsers()
  const userIndex = users.findIndex(u => String(u.id) === String(userId))
  
  if (userIndex === -1) {
    throw new Error('Пользователь не найден')
  }
  
  if (users[userIndex].role === 'admin' && newRole !== 'admin') {
    const adminCount = users.filter(u => u.role === 'admin').length
    if (adminCount <= 1) {
      throw new Error('Нельзя снять роль с последнего администратора')
    }
  }
  
  users[userIndex].role = newRole
  users[userIndex].updatedAt = new Date().toISOString()
  
  await writeUsers(users)
  
  const user = users[userIndex]
  delete user.password
  return user
}

export async function updateUser(userId, updates) {
  const users = await readUsers()
  const userIndex = users.findIndex(u => String(u.id) === String(userId))
  
  if (userIndex === -1) {
    throw new Error('Пользователь не найден')
  }
  
  const protectedFields = ['id', 'password', 'role', 'createdAt']
  
  for (const key of Object.keys(updates)) {
    if (!protectedFields.includes(key)) {
      users[userIndex][key] = updates[key]
    }
  }
  
  users[userIndex].updatedAt = new Date().toISOString()
  
  await writeUsers(users)
  
  const user = users[userIndex]
  delete user.password
  return user
}

export async function deleteUser(userId) {
  const users = await readUsers()
  const userIndex = users.findIndex(u => String(u.id) === String(userId))
  
  if (userIndex === -1) {
    throw new Error('Пользователь не найден')
  }
  
  if (users[userIndex].role === 'admin') {
    const adminCount = users.filter(u => u.role === 'admin').length
    if (adminCount <= 1) {
      throw new Error('Нельзя удалить последнего администратора')
    }
  }
  
  users.splice(userIndex, 1)
  await writeUsers(users)
  
  return true
}

export async function createUser(userData) {
  const users = await readUsers()
  
  if (users.some(u => u.email?.toLowerCase() === userData.email?.toLowerCase())) {
    throw new Error('Пользователь с таким email уже существует')
  }
  
  const newId = users.length > 0 
    ? String(Math.max(...users.map(u => Number(u.id) || 0)) + 1)
    : '1'
  
  const now = new Date().toISOString()
  
  const newUser = {
    id: newId,
    name: userData.name || '',
    email: userData.email?.toLowerCase(),
    password: userData.password,
    role: userData.role || 'user',
    phone: userData.phone || '',
    address: userData.address || '',
    avatar: userData.avatar || '',
    isActive: userData.isActive !== false,
    emailVerified: userData.emailVerified === true,
    lastLogin: null,
    createdAt: now,
    updatedAt: now
  }
  
  users.push(newUser)
  await writeUsers(users)
  
  const user = { ...newUser }
  delete user.password
  return user
}

export default {
  readUsers,
  writeUsers,
  getUserFromSession,
  getUserById,
  getUserByEmail,
  updateUserRole,
  updateUser,
  deleteUser,
  createUser,
  invalidateUsersCache
}