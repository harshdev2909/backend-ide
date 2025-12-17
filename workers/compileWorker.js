require('dotenv').config();
const mongoose = require('mongoose');
const { createWorker, COMPILE_QUEUE_NAME } = require('../queues/bullmq');
const compilationService = require('../services/compilationService');
const socketService = require('../services/socketService');
const Job = require('../models/Job');
const Project = require('../models/Project');

// Initialize socket service for Redis pub/sub (workers don't have Socket.IO instance)
socketService.init(null);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soroban-ide';

// Worker concurrency
const COMPILE_WORKER_CONCURRENCY = parseInt(process.env.COMPILE_WORKER_CONCURRENCY || '2', 10);

/**
 * Process compile job
 */
async function processCompileJob(job) {
  const { projectId, files, jobId } = job.data;
  
  console.log(`[CompileWorker] Processing compile job ${job.id} for project ${projectId}`);
  
  // Update job status to active
  await Job.findByIdAndUpdate(jobId, {
    status: 'active',
    result: {
      success: false,
      logs: [{
        type: 'info',
        message: 'Compilation started...',
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
        console.error('Error updating job logs:', err);
      }
    };
    
    // Call compilation service with log update callback and jobId for WebSocket
    const result = await compilationService.compileProject(projectId, files, updateJobLogs, jobId);
    
    // Update job with result
    const jobResult = {
        success: result.success,
        logs: result.logs,
        wasmBase64: result.wasmBase64 || result.output?.wasm,
        wasmFile: result.output?.wasmFile,
        compilationType: result.compilationType,
        error: result.error
    };
    
    await Job.findByIdAndUpdate(jobId, {
      status: result.success ? 'completed' : 'failed',
      result: jobResult,
      error: result.success ? null : (result.error || 'Compilation failed')
    });
    
    // Emit final status via WebSocket
    const socketService = require('../services/socketService');
    socketService.emitJobStatus(jobId, result.success ? 'completed' : 'failed', jobResult);

    // Update project with compilation info if successful
    if (result.success) {
      try {
        const updateData = {
          updatedAt: new Date()
        };

        // Optionally store WASM in project (can be large, so might want to skip)
        // updateData.lastCompiledWasm = result.wasmBase64 || result.output?.wasm;

        await Project.findByIdAndUpdate(projectId, updateData);
        console.log(`[CompileWorker] Updated project ${projectId} with compilation result`);
      } catch (updateError) {
        console.warn(`[CompileWorker] Could not update project ${projectId}:`, updateError.message);
        // Don't fail the job if project update fails
      }
    }

    console.log(`[CompileWorker] Completed compile job ${job.id} - success: ${result.success}`);
    
    return {
      success: result.success,
      logs: result.logs,
      wasmBase64: result.wasmBase64 || result.output?.wasm,
      wasmFile: result.output?.wasmFile,
      compilationType: result.compilationType
    };
  } catch (error) {
    console.error(`[CompileWorker] Error processing compile job ${job.id}:`, error);
    
    // Update job with error and any logs we have
    const errorLogs = [{
      type: 'error',
      message: `Compilation failed: ${error.message}`,
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

    throw error;
  }
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI).then(() => {
  console.log(`[CompileWorker] Connected to MongoDB: ${MONGODB_URI}`);
}).catch((error) => {
  console.error('[CompileWorker] MongoDB connection error:', error);
  process.exit(1);
});

// Create worker
const worker = createWorker(COMPILE_QUEUE_NAME, processCompileJob, {
  concurrency: COMPILE_WORKER_CONCURRENCY
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`[CompileWorker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[CompileWorker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[CompileWorker] Worker error:', err);
});

console.log(`[CompileWorker] Started with concurrency: ${COMPILE_WORKER_CONCURRENCY}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[CompileWorker] SIGTERM received, closing worker...');
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[CompileWorker] SIGINT received, closing worker...');
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = worker;

