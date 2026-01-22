const { createQueue, COMPILE_QUEUE_NAME } = require('./bullmq');

// Create compile queue instance
const compileQueue = createQueue(COMPILE_QUEUE_NAME);

/**
 * Add a compile job to the queue
 * @param {Object} payload - Job payload
 * @param {string} payload.projectId - MongoDB project ID
 * @param {Array} payload.files - Array of files to compile
 * @param {string} payload.jobId - MongoDB job document ID
 * @param {string} payload.userId - User ID for usage tracking
 * @returns {Promise<Job>} BullMQ job instance
 */
async function addCompileJob(payload) {
  const { projectId, files, jobId, userId } = payload;
  
  if (!projectId || !files || !jobId) {
    throw new Error('Missing required parameters: projectId, files, and jobId');
  }

  const job = await compileQueue.add('compile', {
    projectId,
    files,
    jobId,
    userId
  }, {
    jobId: `compile-${jobId}`, // Use MongoDB job ID as BullMQ job ID
    priority: 1
  });

  console.log(`[CompileQueue] Added compile job ${job.id} for project ${projectId}`);
  
  return job;
}

module.exports = {
  compileQueue,
  addCompileJob
};

