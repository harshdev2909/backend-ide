const express = require('express');
const router = express.Router();
const Job = require('../models/Job');

// GET /api/jobs/:id - Get job status
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await Job.findById(id).populate('project', 'name');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      job: {
        _id: job._id,
        type: job.type,
        status: job.status,
        project: job.project,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });
  } catch (error) {
    console.error('Job fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job',
      message: error.message
    });
  }
});

// GET /api/jobs - List jobs (optional, for admin/debugging)
router.get('/', async (req, res) => {
  try {
    const { projectId, status, type, limit = 50 } = req.query;
    
    const query = {};
    if (projectId) query.project = projectId;
    if (status) query.status = status;
    if (type) query.type = type;
    
    const jobs = await Job.find(query)
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));
    
    res.json({
      success: true,
      jobs: jobs.map(job => ({
        _id: job._id,
        type: job.type,
        status: job.status,
        project: job.project,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }))
    });
  } catch (error) {
    console.error('Jobs list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs',
      message: error.message
    });
  }
});

module.exports = router;

