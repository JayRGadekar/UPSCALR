const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

class ModelManager {
  constructor({
    catalogPath = path.resolve(__dirname, '../../../shared/model-presets.json'),
    settingsPath,
    modelsRoot
  } = {}) {
    this.catalogPath = catalogPath;
    this.settingsPath = settingsPath || path.join(...this._resolveSettingsLocationSegments(), 'settings.json');
    this.settingsDir = path.dirname(this.settingsPath);
    this.defaultModelsRoot = modelsRoot || path.join(...this._resolveSettingsLocationSegments(), 'models');
    this.legacyModelsRoot = path.join(...this._resolveLegacyLocationSegments(), 'models');
    this.catalog = this._loadCatalog();
    this.cached = [];
    this.activeModel = this.catalog[0]?.name ?? null;
    this.downloads = new Map();

    const settings = this._loadSettings();
    const discoveredRoot = settings.storageConfigured
      ? null
      : this._findInstalledRoot([settings.modelsRoot, this.defaultModelsRoot, this.legacyModelsRoot]);

    this.modelsRoot = settings.modelsRoot || discoveredRoot || this.defaultModelsRoot;
    this.runtimeRoot = path.join(this.modelsRoot, '_runtime');
    this.storageConfigured = Boolean(settings.storageConfigured || discoveredRoot || modelsRoot);

    this._ensureSettingsDirectory();
    this._ensureModelDirectories();

    if (discoveredRoot && !settings.storageConfigured) {
      this.storageConfigured = true;
      this._saveSettings();
    }
  }

  async listModels() {
    const discovered = await this._discoverInstalledModels();
    this.cached = this.catalog.map((model) => this._decorateModel(model, discovered));

    if (!this.activeModel && this.cached.length > 0) {
      this.activeModel = this.cached[0].name;
    }

    return this.cached;
  }

  async pullModel(modelName) {
    if (!this.storageConfigured) {
      throw new Error('Choose a model folder before downloading.');
    }

    const model = this.catalog.find((item) => item.name === modelName);
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    if (model.runtime !== 'realesrgan-ncnn') {
      throw new Error(`Unsupported runtime: ${model.runtime}`);
    }

    await this._installRealEsrganBundle(model);
    await this.listModels();
    return this.getModelMetadata(modelName);
  }

  queueModelDownload(modelName) {
    if (!this.storageConfigured) {
      throw new Error('Choose a model folder before downloading.');
    }

    const existing = this.downloads.get(modelName);
    if (existing?.status === 'downloading') {
      return existing;
    }

    const state = {
      model: modelName,
      status: 'downloading',
      progress: 0,
      startedAt: Date.now(),
      error: null
    };
    this.downloads.set(modelName, state);

    this.pullModel(modelName)
      .then(() => {
        this.downloads.set(modelName, {
          ...state,
          status: 'completed',
          progress: 100,
          finishedAt: Date.now(),
          error: null
        });
      })
      .catch((error) => {
        this.downloads.set(modelName, {
          ...state,
          status: 'failed',
          finishedAt: Date.now(),
          error: error.message
        });
      });

    return state;
  }

  async deleteModel(modelName) {
    const model = this.catalog.find((item) => item.name === modelName);
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    fs.rmSync(this._modelDirectory(modelName), { recursive: true, force: true });
    this.downloads.delete(modelName);

    if (model.runtime === 'realesrgan-ncnn') {
      this._deleteRealEsrganBundle();
    }

    this._ensureModelDirectories();
    await this.listModels();
  }

  async setActiveModel(modelName) {
    const metadata = this.getModelMetadata(modelName);
    if (!metadata) {
      throw new Error(`Unknown model: ${modelName}`);
    }
    this.activeModel = modelName;
  }

  async setModelsRoot(modelsRoot) {
    if (!modelsRoot || !path.isAbsolute(modelsRoot)) {
      throw new Error('A valid absolute folder path is required.');
    }

    this.modelsRoot = path.resolve(modelsRoot);
    this.runtimeRoot = path.join(this.modelsRoot, '_runtime');
    this.storageConfigured = true;
    this.downloads.clear();
    this._ensureModelDirectories();
    this._saveSettings();
    await this.listModels();
    return this.getStoragePreferences();
  }

  getActiveModel() {
    return this.activeModel;
  }

  getModelMetadata(modelName) {
    return this.cached.find((model) => model.name === modelName)
      || this.catalog.map((model) => this._decorateModel(model, new Set())).find((model) => model.name === modelName)
      || null;
  }

  getModelsRoot() {
    return this.modelsRoot;
  }

  getStoragePreferences() {
    return {
      configured: this.storageConfigured,
      modelsRoot: this.modelsRoot,
      recommendedRoot: this.defaultModelsRoot,
      legacyRoot: this.legacyModelsRoot
    };
  }

  _ensureSettingsDirectory() {
    fs.mkdirSync(this.settingsDir, { recursive: true });
  }

  _ensureModelDirectories() {
    fs.mkdirSync(this.modelsRoot, { recursive: true });
    fs.mkdirSync(this.runtimeRoot, { recursive: true });
  }

  _loadSettings() {
    if (!fs.existsSync(this.settingsPath)) {
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'));
    } catch (error) {
      return {};
    }
  }

  _saveSettings() {
    const payload = {
      storageConfigured: this.storageConfigured,
      modelsRoot: this.modelsRoot,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(this.settingsPath, JSON.stringify(payload, null, 2));
  }

  _loadCatalog() {
    try {
      const raw = fs.readFileSync(this.catalogPath, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Could not load shared model catalog:', error.message);
      return [];
    }
  }

  _findInstalledRoot(candidates) {
    for (const candidate of candidates.filter(Boolean)) {
      if (this._hasInstalledArtifacts(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  _hasInstalledArtifacts(rootPath) {
    return this.catalog.some((model) => {
      const manifest = this._readManifest(model.name, rootPath);
      return this._isManifestUsable(model, manifest);
    });
  }

  _decorateModel(model, installedModels) {
    const manifest = this._readManifest(model.name);
    const installed = this._isManifestUsable(model, manifest);
    return {
      ...model,
      installed,
      status: installed ? 'ready' : 'not-installed',
      source: installed ? 'local' : 'catalog',
      active: model.name === this.activeModel,
      localPath: this._modelDirectory(model.name),
      downloadLocation: this.modelsRoot,
      sourceUrl: model.source?.browserDownloadUrl || null,
      download: this.downloads.get(model.name) || null,
      ...this._runtimeFieldsFromManifest(manifest)
    };
  }

  _readManifest(modelName, rootOverride = this.modelsRoot) {
    const manifestPath = path.join(rootOverride, modelName, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
      return null;
    }
  }

  _isManifestUsable(model, manifest) {
    if (!manifest) {
      return false;
    }

    if (model.runtime === 'realesrgan-ncnn') {
      if (!this._isManifestCompatibleWithPlatform(manifest)) {
        return false;
      }

      return Boolean(
        manifest.executablePath
        && manifest.modelsPath
        && fs.existsSync(manifest.executablePath)
        && fs.existsSync(manifest.modelsPath)
      );
    }

    return false;
  }

  _runtimeFieldsFromManifest(manifest) {
    if (!manifest) {
      return {};
    }

    const fields = {};
    [
      'installedAt',
      'executablePath',
      'modelsPath',
      'cliModelName',
      'sourceUrl'
    ].forEach((key) => {
      if (manifest[key] !== undefined) {
        fields[key] = manifest[key];
      }
    });

    return fields;
  }

  async _discoverInstalledModels() {
    if (!fs.existsSync(this.modelsRoot)) {
      return new Set();
    }

    return new Set(
      fs.readdirSync(this.modelsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
        .map((entry) => entry.name)
    );
  }

  async _installRealEsrganBundle(model) {
    const runtimeConfig = this._resolveRealEsrganRuntimeConfig(model);
    const bundleDir = path.join(this.runtimeRoot, runtimeConfig.bundleFolder);
    const zipPath = path.join(this.runtimeRoot, runtimeConfig.assetName);
    const executablePath = path.join(bundleDir, runtimeConfig.executableName);
    const modelsPath = path.join(bundleDir, 'models');

    if (!fs.existsSync(executablePath) || !fs.existsSync(modelsPath)) {
      await this._downloadFile(runtimeConfig.browserDownloadUrl, zipPath, (progress) => {
        this._setDownloadState(model.name, { progress: Math.round(progress * 90) });
      });
      this._setDownloadState(model.name, { progress: 90 });
      fs.mkdirSync(bundleDir, { recursive: true });
      await this._extractArchive(zipPath, bundleDir);
      if (process.platform !== 'win32') {
        fs.chmodSync(executablePath, 0o755);
      }
    }

    const modelDir = this._modelDirectory(model.name);
    fs.mkdirSync(modelDir, { recursive: true });

    const manifest = {
      installedAt: new Date().toISOString(),
      runnable: true,
      executablePath,
      modelsPath,
      cliModelName: model.cliModelName,
      supportedFactors: model.supportedFactors,
      sourceUrl: runtimeConfig.browserDownloadUrl,
      platform: process.platform
    };

    fs.writeFileSync(path.join(modelDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  async _extractArchive(zipPath, destination) {
    const attempts = [];
    const tryExtract = async (command, args) => {
      try {
        await execFileAsync(command, args);
        return true;
      } catch (error) {
        attempts.push(`${command}: ${error.message}`);
        return false;
      }
    };

    const escapedZip = zipPath.replace(/'/g, "''");
    const escapedDestination = destination.replace(/'/g, "''");
    const expandArchive = `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDestination}' -Force`;

    if (process.platform === 'win32') {
      if (await tryExtract('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', expandArchive])) {
        return;
      }
      if (await tryExtract('pwsh', ['-NoProfile', '-Command', expandArchive])) {
        return;
      }
    }

    if (await tryExtract('unzip', ['-o', zipPath, '-d', destination])) {
      return;
    }

    if (await tryExtract('tar', ['-xf', zipPath, '-C', destination])) {
      return;
    }

    throw new Error(`Could not extract model archive. Tried: ${attempts.join(' | ')}`);
  }

  _deleteRealEsrganBundle() {
    const knownBundles = [
      {
        bundleDir: 'realesrgan-ncnn-v0.2.5.0-macos',
        assetName: 'realesrgan-ncnn-vulkan-20220424-macos.zip'
      },
      {
        bundleDir: 'realesrgan-ncnn-v0.2.5.0-windows',
        assetName: 'realesrgan-ncnn-vulkan-20220424-windows.zip'
      },
      {
        bundleDir: 'realesrgan-ncnn-v0.2.5.0-ubuntu',
        assetName: 'realesrgan-ncnn-vulkan-20220424-ubuntu.zip'
      }
    ];

    knownBundles.forEach((entry) => {
      fs.rmSync(path.join(this.runtimeRoot, entry.bundleDir), { recursive: true, force: true });
      fs.rmSync(path.join(this.runtimeRoot, entry.assetName), { force: true });
    });
  }

  _resolveSettingsLocationSegments() {
    if (process.platform === 'win32') {
      return [os.homedir(), 'AppData', 'Roaming', 'VLLAMA'];
    }
    return [os.homedir(), 'Library', 'Application Support', 'VLLAMA'];
  }

  _resolveLegacyLocationSegments() {
    if (process.platform === 'win32') {
      return [os.homedir(), 'AppData', 'Roaming', 'UPSCALR'];
    }
    return [os.homedir(), 'Library', 'Application Support', 'UPSCALR'];
  }

  _resolveRealEsrganRuntimeConfig(model) {
    const sharedSource = model.source || {};
    const repo = sharedSource.repo || 'xinntao/Real-ESRGAN';
    const tag = sharedSource.tag || 'v0.2.5.0';
    const releaseBase = `https://github.com/${repo}/releases/download/${tag}`;

    const map = {
      win32: {
        assetName: 'realesrgan-ncnn-vulkan-20220424-windows.zip',
        bundleFolder: 'realesrgan-ncnn-v0.2.5.0-windows',
        executableName: 'realesrgan-ncnn-vulkan.exe'
      },
      darwin: {
        assetName: 'realesrgan-ncnn-vulkan-20220424-macos.zip',
        bundleFolder: 'realesrgan-ncnn-v0.2.5.0-macos',
        executableName: 'realesrgan-ncnn-vulkan'
      },
      linux: {
        assetName: 'realesrgan-ncnn-vulkan-20220424-ubuntu.zip',
        bundleFolder: 'realesrgan-ncnn-v0.2.5.0-ubuntu',
        executableName: 'realesrgan-ncnn-vulkan'
      }
    };

    const selected = map[process.platform] || map.darwin;
    return {
      ...selected,
      browserDownloadUrl: `${releaseBase}/${selected.assetName}`
    };
  }

  _isManifestCompatibleWithPlatform(manifest) {
    if (manifest.platform) {
      return manifest.platform === process.platform;
    }

    const executablePath = String(manifest.executablePath || '').toLowerCase();
    if (process.platform === 'win32') {
      return executablePath.endsWith('.exe');
    }

    return !executablePath.endsWith('.exe');
  }

  async _downloadFile(url, destination, onProgress) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VLLAMA/0.1'
      }
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const total = Number(response.headers.get('content-length') || 0);
    if (!total || !response.body.getReader) {
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination));
      if (onProgress) {
        onProgress(1);
      }
      return;
    }

    const reader = response.body.getReader();
    const writer = fs.createWriteStream(destination);
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        writer.write(Buffer.from(value));
        received += value.length;
        if (onProgress) {
          onProgress(received / total);
        }
      }
    } finally {
      writer.end();
    }
  }

  _setDownloadState(modelName, patch) {
    const existing = this.downloads.get(modelName) || {
      model: modelName,
      status: 'downloading',
      progress: 0,
      startedAt: Date.now(),
      error: null
    };

    this.downloads.set(modelName, {
      ...existing,
      ...patch
    });
  }

  _modelDirectory(modelName) {
    return path.join(this.modelsRoot, modelName);
  }
}

module.exports = ModelManager;
