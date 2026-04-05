const express = require('express');

function createVideoRouter({ videoQueue, modelManager }) {
  const router = express.Router();

  router.post('/upload', async (req, res) => {
    const { inputPath, factor = 4, useGpu = true, model = 'realesrgan-x4plus', mediaType = 'video', metadata = {} } = req.body;
    if (!inputPath) {
      return res.status(400).json({ error: 'inputPath is required' });
    }

    const modelInfo = await modelManager.listModels().then(() => modelManager.getModelMetadata(model));
    if (!modelInfo) {
      return res.status(400).json({ error: `Unknown model: ${model}` });
    }

    if (!modelInfo.installed) {
      return res.status(400).json({ error: `${modelInfo.label} is not downloaded yet.` });
    }

    const supportedFactors = modelInfo.supportedFactors || [];
    if (supportedFactors.length > 0 && !supportedFactors.includes(Number(factor))) {
      return res.status(400).json({ error: `${modelInfo.label} supports ${supportedFactors.join(', ')}x only.` });
    }

    if (modelInfo.runnable === false) {
      return res.status(400).json({ error: modelInfo.launchHint || `${modelInfo.label} is downloaded but not runnable in this lightweight app yet.` });
    }

    const job = videoQueue.enqueueJob({
      inputPath,
      factor,
      useGpu,
      model,
      mediaType,
      metadata,
      modelInfo
    });

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
      payload: job.payload,
      logs: job.logs,
      error: job.error
    });
  });

  return router;
}

module.exports = createVideoRouter;
