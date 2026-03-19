class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.defaultPlugins = [
      { id: 'video', name: 'Video Upscale', description: 'Real-ESRGAN / Video2X wrapper', category: 'media', enabled: true },
      { id: 'llama', name: 'Ollama Model Manager', description: 'Local LLM orchestration', category: 'models', enabled: true }
    ];
    this.defaultPlugins.forEach((plugin) => this.register(plugin));
  }

  register(pluginMeta) {
    if (!pluginMeta.id) {
      throw new Error('Plugin must include an id');
    }
    this.plugins.set(pluginMeta.id, pluginMeta);
  }

  list() {
    return Array.from(this.plugins.values());
  }

  find(id) {
    return this.plugins.get(id);
  }
}

module.exports = PluginRegistry;
