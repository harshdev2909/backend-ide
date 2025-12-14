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
      },
      {
        id: 'voting',
        name: 'Voting Contract',
        description: 'A voting contract with proposal creation and voting functionality',
        category: 'Governance',
        files: ['lib.rs', 'Cargo.toml', 'test.rs']
      },
      {
        id: 'nft',
        name: 'NFT Contract',
        description: 'A non-fungible token contract with mint and transfer functions',
        category: 'NFT',
        files: ['lib.rs', 'Cargo.toml', 'test.rs']
      },
      {
        id: 'escrow',
        name: 'Escrow Contract',
        description: 'An escrow contract for secure payments between parties',
        category: 'DeFi',
        files: ['lib.rs', 'Cargo.toml', 'test.rs']
      },
      {
        id: 'multisig',
        name: 'Multi-Signature Wallet',
        description: 'A multi-signature wallet requiring multiple approvals for transactions',
        category: 'Security',
        files: ['lib.rs', 'Cargo.toml', 'test.rs']
      },
      {
        id: 'auction',
        name: 'Auction Contract',
        description: 'An auction contract with bidding and settlement functionality',
        category: 'Marketplace',
        files: ['lib.rs', 'Cargo.toml', 'test.rs']
      }
    ];
    
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

module.exports = router; 