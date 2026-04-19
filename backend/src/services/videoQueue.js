const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']);
const MEDIA_EXTENSION_PATTERN = 'png|jpg|jpeg|webp|bmp|tif|tiff|mp4|mov|mkv|avi|webm|m4v';

class VideoQueue {
  constructor({
    pythonEntry = path.resolve(__dirname, '../../../services/video-upscale/server.py'),
    pythonBin = process.env.UPSCALR_PYTHON_BIN || 'python3'
  } = {}) {
    this.pythonEntry = pythonEntry;
    this.pythonBin = pythonBin;
    this.pythonCommand = this._resolvePythonCommand();
    this.jobs = new Map();
  }

  enqueueJob(payload) {
    const normalizedInputPath = this._normalizeInputPath(payload.inputPath);
    const resolvedMediaType = this._resolveMediaType(normalizedInputPath, payload.mediaType);
    const jobId = randomUUID();
    const parsed = path.parse(normalizedInputPath);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const suffix = `${payload.model || 'local'}-${payload.factor || 2}x`;
    const defaultExt = resolvedMediaType === 'image' ? '.png' : '.mp4';
    const outputExt = resolvedMediaType === 'video' ? '.mp4' : parsed.ext || defaultExt;
    const outputName = `${parsed.name}-${suffix}${outputExt}`;
    const enhancedPayload = {
      ...payload,
      inputPath: normalizedInputPath,
      mediaType: resolvedMediaType,
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
    const workerArgs = [
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

    const pythonArgs = [...this.pythonCommand.argsPrefix, ...workerArgs];

    if (!this.pythonCommand.available) {
      job.status = 'failed';
      job.error = this.pythonCommand.error;
      job.logs = [this.pythonCommand.error, ...job.logs].slice(0, 40);
      return;
    }

    const proc = spawn(this.pythonCommand.bin, pythonArgs, {
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
        const missingPythonHint = job.logs.some((line) => /python was not found|app execution aliases/i.test(line));
        job.error = missingPythonHint
          ? 'Python is not installed or not available in PATH. Install Python 3 and restart the app.'
          : `Worker exited with code ${code}`;
      }
    });

    job.process = proc;
  }

  _resolvePythonCommand() {
    if (this.pythonBin && this._commandWorks(this.pythonBin, ['--version'])) {
      return {
        available: true,
        bin: this.pythonBin,
        argsPrefix: []
      };
    }

    const candidates = process.platform === 'win32'
      ? [
          { bin: 'py', argsPrefix: ['-3'], probeArgs: ['-3', '--version'] },
          { bin: 'py', argsPrefix: [], probeArgs: ['--version'] },
          { bin: 'python', argsPrefix: [], probeArgs: ['--version'] },
          { bin: 'python3', argsPrefix: [], probeArgs: ['--version'] }
        ]
      : [
          { bin: 'python3', argsPrefix: [], probeArgs: ['--version'] },
          { bin: 'python', argsPrefix: [], probeArgs: ['--version'] }
        ];

    for (const candidate of candidates) {
      if (this._commandWorks(candidate.bin, candidate.probeArgs)) {
        return {
          available: true,
          bin: candidate.bin,
          argsPrefix: candidate.argsPrefix
        };
      }
    }

    return {
      available: false,
      bin: this.pythonBin,
      argsPrefix: [],
      error: 'Python 3 is not available. Install Python and ensure `py -3` or `python` works from a terminal.'
    };
  }

  _commandWorks(command, args) {
    try {
      const result = spawnSync(command, args, {
        stdio: 'ignore',
        shell: process.platform === 'win32'
      });
      return result.status === 0;
    } catch (error) {
      return false;
    }
  }

  _normalizeInputPath(inputPath) {
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

  _resolveMediaType(inputPath, requestedMediaType = 'video') {
    const extension = path.extname(String(inputPath || '')).toLowerCase();
    if (IMAGE_EXTENSIONS.has(extension)) {
      return 'image';
    }
    if (requestedMediaType === 'image' || requestedMediaType === 'video') {
      return requestedMediaType;
    }
    return 'video';
  }
}

module.exports = VideoQueue;
