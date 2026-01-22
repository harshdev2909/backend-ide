require('dotenv').config();
const mongoose = require('mongoose');
const { createWorker, DEPLOY_QUEUE_NAME } = require('../queues/bullmq');
const deploymentService = require('../services/deploymentService');
const socketService = require('../services/socketService');
const Job = require('../models/Job');
const Project = require('../models/Project');
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');

// Initialize socket service for Redis pub/sub (workers don't have Socket.IO instance)
socketService.init(null);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soroban-ide';

// Worker concurrency
const DEPLOY_WORKER_CONCURRENCY = parseInt(process.env.DEPLOY_WORKER_CONCURRENCY || '2', 10);

/**
 * Process deploy job
 */
async function processDeployJob(job) {
  const { projectId, wasmBase64, network, jobId, walletInfo, userId } = job.data;
  
  console.log(`[DeployWorker] Processing deploy job ${job.id} for project ${projectId}`);
  
  // Update job status to active with initial logs
  await Job.findByIdAndUpdate(jobId, {
    status: 'active',
    result: {
      success: false,
      logs: [{
        type: 'info',
        message: 'Deployment started...',
        timestamp: new Date().toISOString()
      }]
    }
  });

  try {
    // Create callback to update job with logs incrementally
    const updateJobLogs = async (logs) => {
      try {
        await Job.findByIdAndUpdate(jobId, {
          'result.logs': logs
        }, { upsert: false });
      } catch (err) {
        console.error('Error updating deployment job logs:', err);
      }
    };
    
    // Call deployment service with log update callback and jobId for WebSocket
    const result = await deploymentService.deployContract(projectId, wasmBase64, network, walletInfo, updateJobLogs, jobId);
    
    // Update job with result
    const jobResult = {
        success: result.success,
        contractAddress: result.contractAddress,
        network: result.network,
        projectId: result.projectId,
        walletAddress: result.walletAddress,
        keypairName: result.keypairName,
        logs: result.logs,
        error: result.error
    };
    
    await Job.findByIdAndUpdate(jobId, {
      status: result.success ? 'completed' : 'failed',
      result: jobResult,
      error: result.success ? null : (result.error || 'Deployment failed')
    });
    
    // Emit final status via WebSocket
    const socketService = require('../services/socketService');
    socketService.emitJobStatus(jobId, result.success ? 'completed' : 'failed', jobResult);

    // Update project with deployment info if successful
    if (result.success && result.contractAddress) {
      try {
        await Project.findByIdAndUpdate(projectId, {
          lastDeployed: new Date(),
          contractAddress: result.contractAddress,
          $push: {
            deploymentHistory: {
              timestamp: new Date(),
              contractAddress: result.contractAddress,
              status: 'success',
              logs: result.logs.map(log => log.message)
            }
          }
        });
        console.log(`[DeployWorker] Updated project ${projectId} with deployment result`);
      } catch (updateError) {
        console.warn(`[DeployWorker] Could not update project ${projectId}:`, updateError.message);
        // Don't fail the job if project update fails
      }
      
      // Increment user deployment count and update usage log
      if (userId) {
        try {
          const user = await User.findById(userId);
          if (user) {
            await user.incrementDeployment();
            
            // Update usage log
            await UsageLog.findOneAndUpdate(
              { userId, action: 'deploy', projectId, success: false },
              {
                success: true,
                contractAddress: result.contractAddress,
                metadata: {
                  ...result,
                  network
                }
              },
              { sort: { createdAt: -1 } }
            );
          }
        } catch (userError) {
          console.warn(`[DeployWorker] Could not update user deployment count:`, userError.message);
        }
      }
    } else {
      // Update usage log on failure
      if (userId) {
        try {
          await UsageLog.findOneAndUpdate(
            { userId, action: 'deploy', projectId, success: false },
            {
              success: false,
              error: result.error || 'Deployment failed',
              metadata: {
                network,
                error: result.error
              }
            },
            { sort: { createdAt: -1 } }
          );
        } catch (logError) {
          console.warn(`[DeployWorker] Could not update usage log:`, logError.message);
        }
      }
    }

    console.log(`[DeployWorker] Completed deploy job ${job.id} - success: ${result.success}`);
    
    return {
      success: result.success,
      contractAddress: result.contractAddress,
      network: result.network,
      projectId: result.projectId,
      walletAddress: result.walletAddress,
      keypairName: result.keypairName,
      logs: result.logs
    };
  } catch (error) {
    console.error(`[DeployWorker] Error processing deploy job ${job.id}:`, error);
    
    // Update job with error and any logs we have
    const errorLogs = [{
      type: 'error',
      message: `Deployment failed: ${error.message}`,
      timestamp: new Date().toISOString()
    }];
    
    await Job.findByIdAndUpdate(jobId, {
      status: 'failed',
      result: {
        success: false,
        logs: errorLogs,
        error: error.message
      },
      error: error.message
    });

    // Also update project deployment history if projectId is valid
    if (projectId && projectId.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        await Project.findByIdAndUpdate(projectId, {
          $push: {
            deploymentHistory: {
              timestamp: new Date(),
              status: 'failed',
              logs: [`Deployment failed: ${error.message}`]
            }
          }
        });
      } catch (updateError) {
        console.warn(`[DeployWorker] Could not update project deployment history:`, updateError.message);
      }
    }

    throw error;
  }
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI).then(() => {
  console.log(`[DeployWorker] Connected to MongoDB: ${MONGODB_URI}`);
}).catch((error) => {
  console.error('[DeployWorker] MongoDB connection error:', error);
  process.exit(1);
});

// Create worker
const worker = createWorker(DEPLOY_QUEUE_NAME, processDeployJob, {
  concurrency: DEPLOY_WORKER_CONCURRENCY
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`[DeployWorker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[DeployWorker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[DeployWorker] Worker error:', err);
});

console.log(`[DeployWorker] Started with concurrency: ${DEPLOY_WORKER_CONCURRENCY}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[DeployWorker] SIGTERM received, closing worker...');
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[DeployWorker] SIGINT received, closing worker...');
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = worker;

