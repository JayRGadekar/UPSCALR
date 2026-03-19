const os = require('node:os');
const { execFileSync } = require('node:child_process');

class ResourceManager {
  constructor({ gpuFallback = 'integrated' } = {}) {
    this.gpuFallback = gpuFallback;
    this.gpuInfo = null;
  }

  async refresh() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuCount = os.cpus().length;
    this.gpuInfo = this._detectGpu();
    this.cachedStats = {
      totalMemory,
      freeMemory,
      cpuCount,
      gpu: this.gpuInfo
    };
    return this.cachedStats;
  }

  getStats() {
    if (!this.cachedStats) {
      return this.refresh();
    }
    return this.cachedStats;
  }

  suggestModel(models) {
    if (!models || !models.length) {
      return null;
    }
    const memoryAvailable = this.cachedStats?.freeMemory || os.freemem();
    return models.find((model) => {
      const metadata = model.recommendedMemory || 0;
      return typeof metadata === 'number' ? metadata < memoryAvailable : true;
    }) || models[0];
  }

  killProcess(pid) {
    try {
      process.kill(pid);
      return true;
    } catch (err) {
      return false;
    }
  }

  _detectGpu() {
    try {
      const output = execFileSync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader'], {
        encoding: 'utf-8'
      }).trim();
      const [name, memory] = output.split(',');
      return {
        name: name?.trim() || 'nvidia',
        memory: memory?.trim() || 'unknown'
      };
    } catch (err) {
      return {
        name: this.gpuFallback,
        memory: 'n/a'
      };
    }
  }
}

module.exports = ResourceManager;
