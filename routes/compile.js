const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const { addCompileJob } = require('../queues/compileQueue');

// POST /api/compile - Compile a project (queued)
router.post('/', async (req, res) => {
  try {
    const { projectId, files } = req.body;
    
    if (!projectId || !files) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectId and files'
      });
    }

    // Generate MongoDB ObjectId first
    const jobId = new mongoose.Types.ObjectId();
    const jobIdString = jobId.toString();
    const bullJobId = `compile-${jobIdString}`;
    
    // Enqueue compile job (uses jobId to create BullMQ job ID)
    const bullJob = await addCompileJob({
      projectId,
      files,
      jobId: jobIdString
    });

    // Verify BullMQ job was created
    if (!bullJob || !bullJob.id) {
      throw new Error('Failed to create BullMQ job');
    }

    // Create job document in MongoDB with BullMQ job ID
    const job = new Job({
      _id: jobId,
      type: 'compile',
      status: 'queued',
      project: projectId,
      bullJobId: bullJob.id || bullJobId
    });
    
    await job.save();

    // Return 202 Accepted with job ID and initial logs
    res.status(202).json({
      success: true,
      jobId: job._id.toString(),
      message: 'Compilation job queued',
      logs: [{
        type: 'info',
        message: 'Compilation job queued successfully',
        timestamp: new Date().toISOString()
      }]
    });
  } catch (error) {
    console.error('Compilation queue error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to queue compilation job',
      message: error.message
    });
  }
});

module.exports = router; 