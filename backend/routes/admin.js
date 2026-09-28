const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { auth, admin } = require('../middleware/auth');

const router = express.Router();

const readUsers = async () => {
  const usersFile = path.join(__dirname, '..', 'data', 'users.json');
  const data = await fs.readFile(usersFile, 'utf8');
  return JSON.parse(data);
};

const writeUsers = async (users) => {
  const usersFile = path.join(__dirname, '..', 'data', 'users.json');
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
};

// All admin routes require admin role
router.use(auth);
router.use(admin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await readUsers();
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);

    res.json({
      users: usersWithoutPasswords,
      total: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// Update user role
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent self-demotion
    if (parseInt(userId) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot remove admin role from yourself' });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === parseInt(userId));

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[userIndex].role = role;
    await writeUsers(users);

    const { password: _, ...updatedUser } = users[userIndex];

    res.json({
      message: 'User role updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Server error updating user role' });
  }
});

// Toggle user status
router.put('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent self-deactivation
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === parseInt(userId));

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[userIndex].isActive = !users[userIndex].isActive;
    await writeUsers(users);

    const { password: _, ...updatedUser } = users[userIndex];

    res.json({
      message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
      user: updatedUser
    });

  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: 'Server error toggling user status' });
  }
});

// Delete user
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent self-deletion
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === parseInt(userId));

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users.splice(userIndex, 1);
    await writeUsers(users);

    res.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error deleting user' });
  }
});

// Get admin statistics
router.get('/stats', async (req, res) => {
  try {
    const users = await readUsers();
    
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      moderatorUsers: users.filter(u => u.role === 'moderator').length,
      regularUsers: users.filter(u => u.role === 'user').length
    };

    res.json({ stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error fetching stats' });
  }
});

module.exports = router;