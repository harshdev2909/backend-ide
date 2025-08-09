const express = require('express');
const router = express.Router();
const compilationService = require('../services/compilationService');

// POST /api/compile - Compile a project
router.post('/', async (req, res) => {
  try {
    const { projectId, files } = req.body;
    
    if (!projectId || !files) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: projectId and files'
      });
    }



    const result = await compilationService.compileProject(projectId, files);
    
    res.json({
      success: result.success,
      logs: result.logs,
      wasmUrl: result.wasmUrl,
      wasmBase64: result.wasmBase64,
      projectId: result.projectId,
      error: result.error
    });
  } catch (error) {
    console.error('Compilation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Compilation failed',
      message: error.message
    });
  }
});

module.exports = router; 