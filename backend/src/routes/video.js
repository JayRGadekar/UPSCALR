const express = require('express');
const path = require('node:path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']);
const MEDIA_EXTENSION_PATTERN = 'png|jpg|jpeg|webp|bmp|tif|tiff|mp4|mov|mkv|avi|webm|m4v';

function sanitizeInputPath(inputPath) {
  if (typeof inputPath !== 'string') {
    return inputPath;
  }

  const flattened = inputPath.replace(/[\r\n]+/g, ' ').trim();
  const unquoted = flattened.replace(/^['"]+|['"]+$/g, '');

  const windowsWithExtMatch = unquoted.match(new RegExp(`[A-Za-z]:\\\\(?:[^<>:"/|?*\\r\\n]+\\\\)*[^<>:"/|?*\\r\\n]+\\.(?:${MEDIA_EXTENSION_PATTERN})`, 'i'));
  const unixWithExtMatch = unquoted.match(new RegExp(`\\/(?:[^/\\0]+\\/)*[^/\\0]+\\.(?:${MEDIA_EXTENSION_PATTERN})`, 'i'));
  const windowsPathMatch = unquoted.match(/[A-Za-z]:\\(?:[^<>:"/|?*\r\n]+\\)*[^<>:"/|?*\r\n]+/);
  const unixPathMatch = unquoted.match(/\/(?:[^/\0]+\/)*[^/\0]+/);
  const extracted = windowsWithExtMatch?.[0]
    || unixWithExtMatch?.[0]
    || windowsPathMatch?.[0]
    || unixPathMatch?.[0]
    || unquoted;

  return path.normalize(extracted.trim());
}

function resolveMediaType(inputPath, requestedMediaType = 'video') {
  const extension = path.extname(String(inputPath || '')).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (requestedMediaType === 'image' || requestedMediaType === 'video') {
    return requestedMediaType;
  }
  return 'video';
}

function createVideoRouter({ videoQueue, modelManager }) {
  const router = express.Router();

  router.post('/upload', async (req, res) => {
    const { inputPath, factor = 4, useGpu = true, model = 'realesrgan-x4plus', mediaType = 'video', metadata = {} } = req.body;
    const normalizedInputPath = sanitizeInputPath(inputPath);
    const normalizedMediaType = resolveMediaType(normalizedInputPath, mediaType);

    if (!normalizedInputPath) {
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
      inputPath: normalizedInputPath,
      factor,
      useGpu,
      model,
      mediaType: normalizedMediaType,
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
