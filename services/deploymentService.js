const { exec, execSync, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const util = require('util');
const execAsync = util.promisify(exec);

// Check if Stellar CLI is available
let stellarAvailable = false;
try {
  execSync('stellar --version', { stdio: 'ignore' });
  stellarAvailable = true;
} catch (error) {
  console.warn('Stellar CLI not available');
}

class DeploymentService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'soroban-deploy');
    this.defaultKeypairName = 'deploy_keypair';
  }

  /**
   * Ensure the default keypair exists, create if it doesn't
   */
  async ensureDefaultKeypair(network = 'testnet') {
    try {
      // Check if keypair exists
      await execAsync(`stellar keys address ${this.defaultKeypairName}`);
      return true;
    } catch (error) {
      // Keypair doesn't exist, create it
      try {
        if (network === 'testnet') {
          // For testnet, create and fund the account automatically
          await execAsync(`stellar keys generate --global ${this.defaultKeypairName} --network ${network} --fund`);
          console.log(`Created and funded default keypair: ${this.defaultKeypairName}`);
        } else {
          // For mainnet, just create (don't auto-fund)
          await execAsync(`stellar keys generate --global ${this.defaultKeypairName} --network ${network}`);
          console.log(`Created default keypair: ${this.defaultKeypairName}`);
        }
        return true;
      } catch (createError) {
        console.error(`Failed to create default keypair: ${createError.message}`);
        return false;
      }
    }
  }

  /**
   * Check Stellar CLI configuration and network connectivity
   */
  async checkStellarConfig(network = 'testnet') {
    const logs = [];
    
    const log = (type, message) => {
      const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
      };
      logs.push(logEntry);
      console.log(`[${type.toUpperCase()}] ${message}`);
    };

    try {
      // Check if Stellar CLI is available
      if (!stellarAvailable) {
        log('error', 'Stellar CLI not available');
        return {
          success: false,
          logs,
          error: 'Stellar CLI not installed'
        };
      }

      // Check Stellar CLI version
      try {
        const { stdout: versionOutput } = await execAsync('stellar --version');
        log('info', `Stellar CLI version: ${versionOutput.trim()}`);
      } catch (error) {
        log('error', `Failed to get Stellar CLI version: ${error.message}`);
        return {
          success: false,
          logs,
          error: 'Stellar CLI version check failed'
        };
      }

      // Check network configuration
      try {
        const { stdout: networkOutput } = await execAsync('stellar network ls');
        log('info', 'Available networks:');
        log('info', networkOutput.trim());
      } catch (error) {
        log('error', `Failed to list networks: ${error.message}`);
        return {
          success: false,
          logs,
          error: 'Network configuration check failed'
        };
      }

      // Check default keypair
      try {
        const { stdout: addressOutput } = await execAsync(`stellar keys address ${this.defaultKeypairName}`);
        const address = addressOutput.trim();
        log('info', `Default keypair address: ${address}`);
      } catch (error) {
        log('warning', `Default keypair not found: ${error.message}`);
        log('info', 'Will create default keypair during deployment');
      }

      log('success', 'Stellar CLI configuration check passed');
      return {
        success: true,
        logs
      };

    } catch (error) {
      log('error', `Configuration check failed: ${error.message}`);
      return {
        success: false,
        logs,
        error: error.message
      };
    }
  }

  /**
   * Validate WASM file format and content
   */
  validateWasmFile(wasmBuffer) {
    const errors = [];
    
    // Check file size
    if (wasmBuffer.length < 8) {
      errors.push('WASM file too small (minimum 8 bytes)');
      return { valid: false, errors };
    }
    
    // Check magic bytes
    const magic = wasmBuffer.slice(0, 4).toString('hex');
    if (magic !== '0061736d') {
      errors.push(`Invalid WASM magic bytes: ${magic} (expected: 0061736d)`);
    }
    
    // Check version
    const version = wasmBuffer.slice(4, 8).toString('hex');
    if (version !== '01000000') {
      errors.push(`Unsupported WASM version: ${version} (expected: 01000000)`);
    }
    
    // Check for basic WASM structure
    if (wasmBuffer.length >= 12) {
      // Look for section headers
      let hasSection = false;
      for (let i = 8; i < Math.min(wasmBuffer.length, 100); i++) {
        if (wasmBuffer[i] >= 0 && wasmBuffer[i] <= 11) {
          hasSection = true;
          break;
        }
      }
      if (!hasSection) {
        errors.push('No valid WASM sections found');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      magic,
      version,
      size: wasmBuffer.length
    };
  }

  /**
   * Deploy a smart contract to Stellar testnet
   */
  async deployContract(projectId, wasmBase64, network = 'testnet', walletInfo = null) {
    const logs = [];
    
    const log = (type, message) => {
      const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
      };
      logs.push(logEntry);
      console.log(`[${type.toUpperCase()}] ${message}`);
      
      
    };
    
    try {
      // Check if Stellar CLI is available
      if (!stellarAvailable) {
        log('error', 'Stellar CLI not available. Please install it first.');
        throw new Error('Stellar CLI not installed');
      }

      // Check Stellar CLI configuration
      const configCheck = await this.checkStellarConfig(network);
      if (!configCheck.success) {
        log('error', `Stellar CLI configuration check failed: ${configCheck.error}`);
        throw new Error(`Configuration check failed: ${configCheck.error}`);
      }

      log('info', `Starting deployment to ${network}...`);

      // Ensure default keypair exists
      const keypairExists = await this.ensureDefaultKeypair(network);
      if (!keypairExists) {
        log('error', 'Failed to ensure default keypair exists');
        throw new Error('Failed to create default keypair');
      }

      // For testnet, ensure the account has enough XLM for deployment
      if (network === 'testnet') {
        try {
          log('info', 'Ensuring testnet account has sufficient XLM...');
          await execAsync(`stellar keys fund ${this.defaultKeypairName} --network ${network}`);
          log('info', 'Account funding verified/completed');
        } catch (fundError) {
          log('warning', `Account funding failed: ${fundError.message}`);
          // Don't fail deployment - the account might already be funded
        }
      }

      // Create project directory
      const projectDir = path.join(this.tempDir, projectId);
      await fs.remove(projectDir);
      await fs.ensureDir(projectDir);

      // Write WASM file
      const wasmBuffer = Buffer.from(wasmBase64, 'base64');
      const wasmPath = path.join(projectDir, 'contract.wasm');
      await fs.writeFile(wasmPath, wasmBuffer);
      log('info', `WASM file written: ${wasmBuffer.length} bytes`);

      // Validate WASM file
      const validation = this.validateWasmFile(wasmBuffer);
      if (!validation.valid) {
        log('error', `WASM validation failed: ${validation.errors.join(', ')}`);
        throw new Error(`Invalid WASM file: ${validation.errors.join(', ')}`);
      }
      
      log('info', `WASM validation passed: magic=${validation.magic}, version=${validation.version}, size=${validation.size} bytes`);

      // Check if WASM file was written correctly
      const stats = await fs.stat(wasmPath);
      log('info', `WASM file size on disk: ${stats.size} bytes`);
      
      if (stats.size !== wasmBuffer.length) {
        log('error', `WASM file size mismatch: expected ${wasmBuffer.length}, got ${stats.size}`);
        throw new Error('WASM file write failed');
      }

      // Get the wallet address
      const { stdout: addressOutput } = await execAsync(`stellar keys address ${this.defaultKeypairName}`);
      const walletAddress = addressOutput.trim();
      log('info', `Using wallet address: ${walletAddress}`);

      // Verify keypair exists and is accessible
      try {
        await execAsync(`stellar keys show ${this.defaultKeypairName}`);
        log('info', `Keypair ${this.defaultKeypairName} verified successfully`);
      } catch (keypairError) {
        log('error', `Keypair ${this.defaultKeypairName} not accessible: ${keypairError.message}`);
        throw new Error(`Keypair not accessible: ${keypairError.message}`);
      }

      // Check account balance before deployment
      try {
        const { stdout: balanceOutput } = await execAsync(`stellar account show ${walletAddress} --network ${network}`);
        log('info', 'Account balance verified');
      } catch (balanceError) {
        log('warning', `Could not verify account balance: ${balanceError.message}`);
        log('info', 'Proceeding with deployment...');
      }

      // Deploy the contract
      log('info', 'Deploying contract...');
      

      
      const deployCommand = `stellar contract deploy --wasm ${wasmPath} --source-account ${this.defaultKeypairName} --network ${network} --alias ${projectId}`;
      
      log('debug', `Deploy command: ${deployCommand}`);
      
      // Execute deployment command with real-time output streaming
      const deployProcess = spawn('stellar', [
        'contract', 'deploy',
        '--wasm', wasmPath,
        '--source-account', this.defaultKeypairName,
        '--network', network,
        '--alias', projectId
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      let deployOutput = '';
      let deployError = '';

      // Stream stdout in real-time
      deployProcess.stdout.on('data', (data) => {
        const output = data.toString();
        deployOutput += output;
        

      });

      // Stream stderr in real-time
      deployProcess.stderr.on('data', (data) => {
        const error = data.toString();
        deployError += error;
        

      });

      // Wait for deployment to complete
      await new Promise((resolve, reject) => {
        deployProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Deployment process exited with code ${code}`));
          }
        });
      });

      // Extract contract ID from output
      const contractId = this.extractContractId(deployOutput);
      if (!contractId) {
        log('error', 'Failed to extract contract ID from deployment output');
        log('error', `Deployment output: ${deployOutput}`);
        throw new Error('Failed to extract contract ID from deployment output');
      }

      log('success', `Contract deployed successfully with ID: ${contractId}`);



      return {
        success: true,
        logs,
        contractAddress: contractId,
        network,
        projectId,
        walletAddress,
        keypairName: this.defaultKeypairName
      };

    } catch (error) {
      log('error', `Deployment failed: ${error.message}`);
      

      
      return {
        success: false,
        logs,
        error: error.message
      };
    } finally {
      // Cleanup
      try {
        const projectDir = path.join(this.tempDir, projectId);
        await fs.remove(projectDir);
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
  }

  /**
   * Invoke a contract function
   */
  async invokeContract(contractId, functionName, args = [], sourceAccount = null, network = 'testnet') {
    const logs = [];
    
    const log = (type, message) => {
      const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
      };
      logs.push(logEntry);
      console.log(`[${type.toUpperCase()}] ${message}`);
    };

    try {
      log('info', `Invoking contract function: ${functionName}`);
      log('info', `Contract ID: ${contractId}`);

      // Use default keypair if no source account provided
      const sourceKeypair = sourceAccount || this.defaultKeypairName;

      // Build invoke command
      let invokeCommand = `stellar contract invoke --id ${contractId} --source-account ${sourceKeypair} --network ${network} -- ${functionName}`;
      
      // Add arguments if provided
      if (args && args.length > 0) {
        args.forEach(arg => {
          invokeCommand += ` ${arg}`;
        });
      }

      log('info', `Invoke command: ${invokeCommand}`);
      
      const { stdout, stderr } = await execAsync(invokeCommand);
      
      if (stderr) {
        log('warning', `Stderr: ${stderr}`);
      }

      log('success', 'Contract function invoked successfully');
      log('info', `Output: ${stdout}`);

      return {
        success: true,
        logs,
        output: stdout.trim(),
        contractId,
        functionName,
        args
      };

    } catch (error) {
      log('error', `Contract invocation failed: ${error.message}`);
      
      return {
        success: false,
        logs,
        error: error.message
      };
    }
  }

  /**
   * Install WASM to network (equivalent to upload)
   */
  async uploadWasm(wasmBase64, sourceAccount = null, network = 'testnet') {
    const logs = [];
    
    const log = (type, message) => {
      const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
      };
      logs.push(logEntry);
      console.log(`[${type.toUpperCase()}] ${message}`);
    };

    try {
      // Create temporary WASM file
      const tempDir = path.join(os.tmpdir(), `wasm-upload-${Date.now()}`);
      await fs.ensureDir(tempDir);
      const wasmPath = path.join(tempDir, 'contract.wasm');
      
      const wasmBuffer = Buffer.from(wasmBase64, 'base64');
      await fs.writeFile(wasmPath, wasmBuffer);
      
      log('info', 'Installing WASM to network...');
      
      // Validate WASM file
      const validation = this.validateWasmFile(wasmBuffer);
      if (!validation.valid) {
        log('error', `WASM validation failed: ${validation.errors.join(', ')}`);
        throw new Error(`Invalid WASM file: ${validation.errors.join(', ')}`);
      }
      
      log('info', `WASM validation passed: magic=${validation.magic}, version=${validation.version}, size=${validation.size} bytes`);
      
      const sourceKeypair = sourceAccount || this.defaultKeypairName;
      const installCommand = `stellar contract install --network ${network} --source-account ${sourceKeypair} --wasm ${wasmPath}`;
      
      log('debug', `Install command: ${installCommand}`);
      
      const { stdout, stderr } = await execAsync(installCommand);
      
      if (stderr) {
        log('warning', `Stderr: ${stderr}`);
      }

      // Extract WASM hash from output
      const wasmHash = this.extractWasmHash(stdout);
      
      if (!wasmHash) {
        log('error', 'Failed to extract WASM hash from install output');
        log('error', `Install output: ${stdout}`);
        throw new Error('Failed to extract WASM hash from install output');
      }

      log('success', `WASM installed successfully with hash: ${wasmHash}`);

      return {
        success: true,
        logs,
        wasmHash,
        network
      };

    } catch (error) {
      log('error', `WASM install failed: ${error.message}`);
      
      return {
        success: false,
        logs,
        error: error.message
      };
    } finally {
      // Cleanup
      try {
        const tempDir = path.join(os.tmpdir(), `wasm-upload-${Date.now()}`);
        await fs.remove(tempDir);
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
  }

  /**
   * Deploy using WASM hash (alternative to direct WASM deployment)
   */
  async deployWithWasmHash(wasmHash, alias, sourceAccount = null, network = 'testnet') {
    const logs = [];
    
    const log = (type, message) => {
      const logEntry = {
        type,
        message,
        timestamp: new Date().toISOString()
      };
      logs.push(logEntry);
      console.log(`[${type.toUpperCase()}] ${message}`);
    };

    try {
      log('info', `Deploying contract with WASM hash: ${wasmHash}`);
      
      // Validate WASM hash format
      if (!wasmHash || wasmHash.length !== 64 || !/^[a-f0-9]{64}$/.test(wasmHash)) {
        log('error', 'Invalid WASM hash format');
        throw new Error('Invalid WASM hash format');
      }
      
      const sourceKeypair = sourceAccount || this.defaultKeypairName;
      const deployCommand = `stellar contract deploy --wasm-hash ${wasmHash} --source-account ${sourceKeypair} --network ${network} --alias ${alias}`;
      
      log('debug', `Deploy command: ${deployCommand}`);
      
      const { stdout, stderr } = await execAsync(deployCommand);
      
      if (stderr) {
        log('warning', `Stderr: ${stderr}`);
      }

      // Extract contract ID from output
      const contractId = this.extractContractId(stdout);
      
      if (!contractId) {
        log('error', 'Failed to extract contract ID from deployment output');
        log('error', `Deployment output: ${stdout}`);
        throw new Error('Failed to extract contract ID from deployment output');
      }

      log('success', `Contract deployed successfully with ID: ${contractId}`);

      return {
        success: true,
        logs,
        contractAddress: contractId,
        network,
        alias,
        wasmHash
      };

    } catch (error) {
      log('error', `Deployment failed: ${error.message}`);
      
      return {
        success: false,
        logs,
        error: error.message
      };
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(network = 'testnet') {
    try {
      const { stdout } = await execAsync('stellar network ls');
      return {
        success: true,
        network,
        info: stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get default keypair information
   */
  async getDefaultKeypairInfo() {
    try {
      const { stdout } = await execAsync(`stellar keys address ${this.defaultKeypairName}`);
      const address = stdout.trim();
      
      return {
        success: true,
        keypair: {
          name: this.defaultKeypairName,
          address
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract contract ID from CLI output
   */
  extractContractId(output) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for contract ID starting with C
      if (line.trim().startsWith('C') && line.trim().length > 50) {
        return line.trim();
      }
      
      // Look for "Contract ID:" format
      if (line.includes('Contract ID:')) {
        const contractId = line.split('Contract ID:')[1].trim();
        if (contractId && contractId.startsWith('C')) {
          return contractId;
        }
      }
      
      // Look for "id:" format
      if (line.includes('id:') && line.includes('C')) {
        const match = line.match(/id:\s*(C[A-Z0-9]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
      
      // Look for JSON format
      if (line.includes('"id"') && line.includes('C')) {
        const match = line.match(/"id":\s*"(C[A-Z0-9]+)"/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Extract WASM hash from CLI output
   */
  extractWasmHash(output) {
    // Look for a 64-character hex string (wasm hash)
    const hashMatch = output.match(/[a-f0-9]{64}/);
    if (hashMatch) {
      return hashMatch[0];
    }
    return null;
  }
}

module.exports = new DeploymentService(); 