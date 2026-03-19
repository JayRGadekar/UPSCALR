const express = require('express');

function createVideoRouter({ videoQueue }) {
  const router = express.Router();

  router.post('/upload', (req, res) => {
    const { inputPath, factor = 2, useGpu = true, model = 'llama3-mini', mediaType = 'video', metadata = {} } = req.body;
    if (!inputPath) {
      return res.status(400).json({ error: 'inputPath is required' });
    }
    const job = videoQueue.enqueueJob({ inputPath, factor, useGpu, model, mediaType, metadata });
    res.json({
      jobId: job.id,
      status: job.status,
      submittedAt: job.submittedAt,
      payload: job.payload
    });
  });

  router.get('/status', (req, res) => {
    const { jobId } = req.query;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }
    const job = videoQueue.getStatus(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      payload: job.payload
    });
  });

  return router;
}

module.exports = createVideoRouter;
