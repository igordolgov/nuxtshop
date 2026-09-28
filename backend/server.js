const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Ensure data directory exists
const ensureDataDir = async () => {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

// Initialize data file with admin user
const initializeData = async () => {
  await ensureDataDir();
  
  const usersFile = path.join(__dirname, 'data', 'users.json');
  try {
    await fs.access(usersFile);
  } catch {
    // Create default admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const defaultUsers = [
      {
        id: 1,
        name: 'Администратор',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null
      }
    ];
    
    await fs.writeFile(usersFile, JSON.stringify(defaultUsers, null, 2));
    console.log('✅ Default admin user created: admin@example.com / admin123');
  }
};

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Backend is running!', 
    timestamp: new Date().toISOString(),
    simple: true 
  });
});

// Initialize and start server
const startServer = async () => {
  await initializeData();
  
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Simple backend running on port ${PORT}`);
    console.log(`🔐 Default admin: admin@example.com / admin123`);
  });
};

startServer().catch(console.error);