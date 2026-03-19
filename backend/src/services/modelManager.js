const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

class ModelManager {
  constructor({ ollamaPath = 'ollama' } = {}) {
    this.ollamaPath = ollamaPath;
    this.cached = [];
    this.activeModel = null;
  }

  async listModels() {
    try {
      const { stdout } = await execFileAsync(this.ollamaPath, ['list', 'models']);
      const models = this._parseList(stdout);
      this.cached = models;
      return models;
    } catch (err) {
      console.warn('Could not query Ollama:', err.message);
      return this.cached;
    }
  }

  async pullModel(modelName) {
    await execFileAsync(this.ollamaPath, ['pull', modelName]);
    return this.getModelMetadata(modelName);
  }

  async deleteModel(modelName) {
    await execFileAsync(this.ollamaPath, ['delete', modelName]);
    this.cached = this.cached.filter((m) => m.name !== modelName);
    if (this.activeModel === modelName) {
      this.activeModel = null;
    }
  }

  async setActiveModel(modelName) {
    this.activeModel = modelName;
  }

  getActiveModel() {
    return this.activeModel;
  }

  getModelMetadata(modelName) {
    const match = this.cached.find((m) => m.name === modelName);
    if (match) {
      return match;
    }
    return {
      name: modelName,
      size: 'unknown',
      recommendedMemory: 'unknown',
      source: 'ollama'
    };
  }

  _parseList(raw) {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        size: 'unknown',
        recommendedMemory: 'unknown',
        status: 'idle'
      }));
  }
}

module.exports = ModelManager;
