const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const readUsers = async () => {
  const usersFile = path.join(__dirname, '..', 'data', 'users.json');
  const data = await fs.readFile(usersFile, 'utf8');
  return JSON.parse(data);
};

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const users = await readUsers();
    const user = users.find(u => u.id === decoded.userId && u.isActive);
    
    if (!user) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Token is not valid' });
  }
};

const admin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin rights required.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error in admin middleware' });
  }
};

const moderator = async (req, res, next) => {
  try {
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Moderator rights required.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error in moderator middleware' });
  }
};

module.exports = { auth, admin, moderator };