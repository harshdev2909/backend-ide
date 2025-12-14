const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Project = require('../models/Project');
const { addDeployJob } = require('../queues/deployQueue');
const deploymentService = require('../services/deploymentService');

// POST /api/deploy - Deploy a smart contract (queued)
router.post('/', async (req, res) => {
  try {
    const { projectId, wasmBase64, network = 'testnet', walletInfo } = req.body;
    
    if (!projectId || !wasmBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectId and wasmBase64'
      });
    }

    // Generate MongoDB ObjectId first
    const jobId = new mongoose.Types.ObjectId();
    const jobIdString = jobId.toString();
    const bullJobId = `deploy-${jobIdString}`;
    
    // Enqueue deploy job (uses jobId to create BullMQ job ID)
    const bullJob = await addDeployJob({
      projectId,
      wasmBase64,
      network,
      jobId: jobIdString,
      walletInfo
    });

    // Verify BullMQ job was created
    if (!bullJob || !bullJob.id) {
      throw new Error('Failed to create BullMQ job');
    }

    // Create job document in MongoDB with BullMQ job ID
    const job = new Job({
      _id: jobId,
      type: 'deploy',
      status: 'queued',
      project: projectId,
      bullJobId: bullJob.id || bullJobId
    });
    
    await job.save();

    // Return 202 Accepted with job ID and initial logs
    res.status(202).json({
      success: true,
      jobId: job._id.toString(),
      message: 'Deployment job queued',
      logs: [{
        type: 'info',
        message: 'Deployment job queued successfully',
        timestamp: new Date().toISOString()
      }]
    });
  } catch (error) {
    console.error('Deployment queue error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to queue deployment job',
      message: error.message
    });
  }
});

// POST /api/deploy/prepare-deployment - Prepare deployment (compatibility route)
router.post('/prepare-deployment', async (req, res) => {
  try {
    const { projectId, wasmBase64, network = 'testnet' } = req.body;
    
    if (!projectId || !wasmBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectId and wasmBase64'
      });
    }

    // Deploy contract directly using the simplified service
    const deploymentResult = await deploymentService.deployContract(projectId, wasmBase64, network);
    
    // Update project with deployment info (optional - only if projectId is valid)
    if (deploymentResult.success && deploymentResult.contractAddress) {
      try {
        // Check if projectId is a valid MongoDB ObjectId
        if (projectId.match(/^[0-9a-fA-F]{24}$/)) {
          await Project.findByIdAndUpdate(projectId, {
            lastDeployed: new Date(),
            contractAddress: deploymentResult.contractAddress,
            $push: {
              deploymentHistory: {
                timestamp: new Date(),
                contractAddress: deploymentResult.contractAddress,
                status: 'success',
                logs: deploymentResult.logs.map(log => log.message)
              }
            }
          });
        }
      } catch (updateError) {
        console.warn('Could not update project:', updateError.message);
        // Continue with deployment even if project update fails
      }
    }
    
    res.json({
      success: deploymentResult.success,
      contractAddress: deploymentResult.contractAddress,
      network: deploymentResult.network,
      projectId: deploymentResult.projectId,
      walletAddress: deploymentResult.walletAddress,
      keypairName: deploymentResult.keypairName,
      logs: deploymentResult.logs,
      deployed: deploymentResult.success,
      isMock: deploymentResult.isMock || false
    });
  } catch (error) {
    console.error('Deployment preparation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Deployment preparation failed',
      message: error.message
    });
  }
});

// POST /api/deploy/invoke - Invoke a contract function
router.post('/invoke', async (req, res) => {
  try {
    const { contractId, functionName, args = [], sourceAccount, network = 'testnet' } = req.body;
    
    if (!contractId || !functionName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: contractId and functionName'
      });
    }

    // Invoke contract function
    const invokeResult = await deploymentService.invokeContract(contractId, functionName, args, sourceAccount, network);
    
    res.json({
      success: invokeResult.success,
      output: invokeResult.output,
      contractId: invokeResult.contractId,
      functionName: invokeResult.functionName,
      args: invokeResult.args,
      logs: invokeResult.logs
    });
  } catch (error) {
    console.error('Contract invocation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Contract invocation failed',
      message: error.message
    });
  }
});

// POST /api/deploy/upload-wasm - Upload WASM to network
router.post('/upload-wasm', async (req, res) => {
  try {
    const { wasmBase64, sourceAccount, network = 'testnet' } = req.body;
    
    if (!wasmBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: wasmBase64'
      });
    }

    // Upload WASM to network
    const uploadResult = await deploymentService.uploadWasm(wasmBase64, sourceAccount, network);
    
    res.json({
      success: uploadResult.success,
      wasmHash: uploadResult.wasmHash,
      network: uploadResult.network,
      logs: uploadResult.logs,
      isMock: uploadResult.isMock || false
    });
  } catch (error) {
    console.error('WASM upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'WASM upload failed',
      message: error.message
    });
  }
});

// POST /api/deploy/with-hash - Deploy using WASM hash
router.post('/with-hash', async (req, res) => {
  try {
    const { wasmHash, alias, sourceAccount, network = 'testnet' } = req.body;
    
    if (!wasmHash || !alias) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: wasmHash and alias'
      });
    }

    // Deploy using WASM hash
    const deployResult = await deploymentService.deployWithWasmHash(wasmHash, alias, sourceAccount, network);
    
    res.json({
      success: deployResult.success,
      contractAddress: deployResult.contractAddress,
      network: deployResult.network,
      alias: deployResult.alias,
      wasmHash: deployResult.wasmHash,
      logs: deployResult.logs,
      isMock: deployResult.isMock || false
    });
  } catch (error) {
    console.error('Hash-based deployment error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Hash-based deployment failed',
      message: error.message
    });
  }
});

// GET /api/deploy/network-info - Get network information
router.get('/network-info', async (req, res) => {
  try {
    const { network = 'testnet' } = req.query;
    
    const networkInfo = await deploymentService.getNetworkInfo(network);
    
    res.json({
      success: networkInfo.success,
      network: networkInfo.network,
      info: networkInfo.info,
      error: networkInfo.error
    });
  } catch (error) {
    console.error('Network info error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get network info',
      message: error.message
    });
  }
});

// GET /api/deploy/keypair-info - Get default keypair information
router.get('/keypair-info', async (req, res) => {
  try {
    const keypairInfo = await deploymentService.getDefaultKeypairInfo();
    
    res.json({
      success: keypairInfo.success,
      keypair: keypairInfo.keypair,
      error: keypairInfo.error
    });
  } catch (error) {
    console.error('Keypair info error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get keypair info',
      message: error.message
    });
  }
});

module.exports = router; 