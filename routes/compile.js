const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Project = require('../models/Project');
const UsageLog = require('../models/UsageLog');
const { addCompileJob } = require('../queues/compileQueue');
const { authenticate } = require('../middleware/auth');

// POST /api/compile - Compile a project (queued)
router.post('/', authenticate, async (req, res) => {
  try {
    const { projectId, files } = req.body;
    const user = req.user;
    
    if (!projectId || !files) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectId and files'
      });
    }

    // Verify project belongs to user
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    if (project.userId.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to compile this project'
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
      jobId: jobIdString,
      userId: user._id.toString()
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
      userId: user._id,
      project: projectId,
      bullJobId: bullJob.id || bullJobId
    });
    
    await job.save();
    
    // Log compilation attempt (unlimited but we log it)
    const usageLog = new UsageLog({
      userId: user._id,
      action: 'compile',
      projectId,
      success: false,
      metadata: {
        jobId: jobIdString
      }
    });
    await usageLog.save();

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