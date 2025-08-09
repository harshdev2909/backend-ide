const express = require('express');
const router = express.Router();

// GET /api/templates - Get available project templates
router.get('/', async (req, res) => {
  try {
    const templates = [
      {
        id: 'hello-world',
        name: 'Hello World',
        description: 'A simple hello world contract',
        category: 'Basic',
        files: ['lib.rs', 'Cargo.toml']
      },
      {
        id: 'counter',
        name: 'Counter Contract',
        description: 'A counter contract with increment/decrement functions',
        category: 'Basic',
        files: ['lib.rs', 'Cargo.toml', 'test.rs']
      },
      {
        id: 'token',
        name: 'Token Contract',
        description: 'A basic token contract with mint and balance functions',
        category: 'Token',
        files: ['lib.rs', 'Cargo.toml']
      }
    ];
    
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

module.exports = router; 