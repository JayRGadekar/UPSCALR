const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');

class VideoQueue {
  constructor({
    pythonEntry = path.resolve(__dirname, '../../../services/video-upscale/server.py'),
    pythonBin = process.env.UPSCALR_PYTHON_BIN || 'python3'
  } = {}) {
    this.pythonEntry = pythonEntry;
    this.pythonBin = pythonBin;
    this.jobs = new Map();
  }

  enqueueJob(payload) {
    const jobId = randomUUID();
    const parsed = path.parse(payload.inputPath);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const suffix = `${payload.model || 'local'}-${payload.factor || 2}x`;
    const defaultExt = payload.mediaType === 'image' ? '.png' : '.mp4';
    const outputExt = payload.mediaType === 'video' ? '.mp4' : parsed.ext || defaultExt;
    const outputName = `${parsed.name}-${suffix}${outputExt}`;
    const enhancedPayload = {
      ...payload,
      outputPath: path.join(downloadsDir, outputName),
      worker: 'python-realesrgan'
    };
    const job = {
      id: jobId,
      status: 'queued',
      progress: 0,
      submittedAt: Date.now(),
      payload: enhancedPayload,
      logs: []
    };
    this.jobs.set(jobId, job);
    this._start(job);
    return job;
  }

  getStatus(jobId) {
    return this.jobs.get(jobId);
  }

  _start(job) {
    job.status = 'running';
    const modelInfo = job.payload.modelInfo || {};
    const args = [
      this.pythonEntry,
      '--input',
      job.payload.inputPath,
      '--media-type',
      job.payload.mediaType || 'video',
      '--model',
      job.payload.model,
      '--model-runtime',
      modelInfo.runtime || 'unknown',
      '--factor',
      String(job.payload.factor),
      '--model-cli-name',
      modelInfo.cliModelName || '',
      '--models-path',
      modelInfo.modelsPath || '',
      '--executable-path',
      modelInfo.executablePath || '',
      job.payload.useGpu ? '--gpu' : '--cpu',
      '--output',
      job.payload.outputPath
    ];

    const proc = spawn(this.pythonBin, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stdout.on('data', (chunk) => {
      chunk
        .toString()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const match = line.match(/progress:(\d+)%/);
          if (match) {
            job.progress = Number(match[1]);
            return;
          }

          job.logs = [line, ...job.logs].slice(0, 40);
        });
    });

    proc.stderr.on('data', (chunk) => {
      chunk
        .toString()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          job.logs = [`stderr: ${line}`, ...job.logs].slice(0, 40);
        });
    });

    proc.on('error', (error) => {
      job.status = 'failed';
      job.error = error.message;
      job.logs = [`worker-error: ${error.message}`, ...job.logs].slice(0, 40);
    });

    proc.on('close', (code) => {
      job.status = code === 0 ? 'completed' : 'failed';
      job.progress = code === 0 ? 100 : job.progress;
      if (code !== 0) {
        job.error = `Worker exited with code ${code}`;
      }
    });

    job.process = proc;
  }
}

module.exports = VideoQueue;
