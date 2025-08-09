const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// GET /api/projects - List all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ updatedAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects - Create new project
router.post('/', async (req, res) => {
  try {
    const { name, files, template } = req.body;
    
    let defaultFiles;
    
    if (template === 'counter') {
      defaultFiles = [
        {
          name: 'lib.rs',
          type: 'file',
          content: `#![no_std]
use core::clone::Clone;
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol, Vec};

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    pub fn increment(env: Env) -> i32 {
        let key = symbol_short!("counter");
        let current: i32 = env.storage().instance().get(&key).unwrap_or(0);
        let new_value = current + 1;
        env.storage().instance().set(&key, &new_value);
        new_value
    }

    pub fn decrement(env: Env) -> i32 {
        let key = symbol_short!("counter");
        let current: i32 = env.storage().instance().get(&key).unwrap_or(0);
        let new_value = current - 1;
        env.storage().instance().set(&key, &new_value);
        new_value
    }

    pub fn get(env: Env) -> i32 {
        let key = symbol_short!("counter");
        env.storage().instance().get(&key).unwrap_or(0)
    }
}`
        },
        {
          name: 'Cargo.toml',
          type: 'file',
          content: `[package]
name = "counter-contract"
version = "0.1.0"
edition = "2021"

[dependencies]
soroban-sdk = "22.0.0"

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils"] }

[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "z"
overflow-checks = true`
        },
        {
          name: '.cargo/config.toml',
          type: 'file',
          content: `[target.wasm32v1-none]
rustflags = [
    "-C", "target-feature=-crt-static",
    "-C", "link-arg=--no-entry"
]`
        },
        {
          name: 'test.rs',
          type: 'file',
          content: `#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_increment() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CounterContract);
        let client = CounterContractClient::new(&env, &contract_id);

        assert_eq!(client.get(), 0);
        assert_eq!(client.increment(), 1);
        assert_eq!(client.get(), 1);
    }

    #[test]
    fn test_decrement() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CounterContract);
        let client = CounterContractClient::new(&env, &contract_id);

        assert_eq!(client.get(), 0);
        assert_eq!(client.decrement(), -1);
        assert_eq!(client.get(), -1);
    }
}`
        }
      ];
    } else if (template === 'token') {
      defaultFiles = [
        {
          name: 'lib.rs',
          type: 'file',
          content: `#![no_std]
use core::clone::Clone;
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol, Address, Vec};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(env: Env, admin: Address, decimals: u32, name: Symbol, symbol: Symbol) {
        env.storage().instance().set(&symbol_short!("admin"), &admin);
        env.storage().instance().set(&symbol_short!("decimals"), &decimals);
        env.storage().instance().set(&symbol_short!("name"), &name);
        env.storage().instance().set(&symbol_short!("symbol"), &symbol);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        admin.require_auth();
        
        let key = symbol_short!("balance");
        let current: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(current + amount));
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        let key = symbol_short!("balance");
        env.storage().instance().get(&key).unwrap_or(0)
    }
}`
        },
        {
          name: 'Cargo.toml',
          type: 'file',
          content: `[package]
name = "token-contract"
version = "0.1.0"
edition = "2021"

[dependencies]
soroban-sdk = "22.0.0"

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils"] }

[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "z"
overflow-checks = true`
        },
        {
          name: '.cargo/config.toml',
          type: 'file',
          content: `[target.wasm32v1-none]
rustflags = [
    "-C", "target-feature=-crt-static",
    "-C", "link-arg=--no-entry"
]`
        }
      ];
    } else {
      // Default hello world template
      defaultFiles = files || [
        {
          name: 'lib.rs',
          type: 'file',
          content: `#![no_std]
// Soroban smart contract
use core::clone::Clone;
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(_env: Env, _to: Symbol) -> Symbol {
        symbol_short!("Hello")
    }
}`
        },
        {
          name: 'Cargo.toml',
          type: 'file',
          content: `[package]
name = "hello-world"
version = "0.1.0"
edition = "2021"

[dependencies]
soroban-sdk = "22.0.0"

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils"] }

[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "z"
overflow-checks = true`
        },
        {
          name: '.cargo/config.toml',
          type: 'file',
          content: `[target.wasm32v1-none]
rustflags = [
    "-C", "target-feature=-crt-static",
    "-C", "link-arg=--no-entry"
]`
        }
      ];
    }

    const project = new Project({
      name: name || 'Untitled Project',
      files: defaultFiles
    });

    const savedProject = await project.save();
    res.status(201).json(savedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id - Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req, res) => {
  try {
    const { name, files } = req.body;
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (files !== undefined) updateData.files = files;
    
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router; 