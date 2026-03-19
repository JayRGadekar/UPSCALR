const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');

class VideoQueue {
  constructor({ pythonEntry = path.resolve(__dirname, '../../../services/video-upscale/server.py') } = {}) {
    this.pythonEntry = pythonEntry;
    this.jobs = new Map();
  }

  enqueueJob(payload) {
    const jobId = randomUUID();
    const parsed = path.parse(payload.inputPath);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const outputName = `${parsed.name}-upscaled${parsed.ext || '.mp4'}`;
    const enhancedPayload = {
      ...payload,
      outputPath: path.join(downloadsDir, outputName)
    };
    const job = {
      id: jobId,
      status: 'queued',
      progress: 0,
      submittedAt: Date.now(),
      payload: enhancedPayload
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
    const args = [
      '--input',
      job.payload.inputPath,
      '--factor',
      job.payload.factor.toString(),
      job.payload.useGpu ? '--gpu' : '--cpu',
      '--output',
      job.payload.outputPath
    ];

    const proc = spawn('python', [this.pythonEntry, ...args], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stdout.on('data', (chunk) => {
      job.progress = Math.min(100, job.progress + 15);
    });

    proc.stderr.on('data', (chunk) => {
      console.warn(`[video-queue] ${chunk}`.trim());
    });

    proc.on('close', (code) => {
      job.status = code === 0 ? 'completed' : 'failed';
      job.progress = 100;
    });

    job.process = proc;
  }
}

module.exports = VideoQueue;
