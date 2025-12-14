const { createQueue, DEPLOY_QUEUE_NAME } = require('./bullmq');

// Create deploy queue instance
const deployQueue = createQueue(DEPLOY_QUEUE_NAME);

/**
 * Add a deploy job to the queue
 * @param {Object} payload - Job payload
 * @param {string} payload.projectId - MongoDB project ID
 * @param {string} payload.wasmBase64 - Base64 encoded WASM file
 * @param {string} payload.network - Network to deploy to (default: testnet)
 * @param {string} payload.jobId - MongoDB job document ID
 * @param {Object} payload.walletInfo - Optional wallet information
 * @returns {Promise<Job>} BullMQ job instance
 */
async function addDeployJob(payload) {
  const { projectId, wasmBase64, network = 'testnet', jobId, walletInfo } = payload;
  
  if (!projectId || !wasmBase64 || !jobId) {
    throw new Error('Missing required parameters: projectId, wasmBase64, and jobId');
  }

  const job = await deployQueue.add('deploy', {
    projectId,
    wasmBase64,
    network,
    jobId,
    walletInfo
  }, {
    jobId: `deploy-${jobId}`, // Use MongoDB job ID as BullMQ job ID
    priority: 1
  });

  console.log(`[DeployQueue] Added deploy job ${job.id} for project ${projectId}`);
  
  return job;
}

module.exports = {
  deployQueue,
  addDeployJob
};

