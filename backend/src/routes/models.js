const express = require('express');

function createModelRouter({ modelManager, resourceManager }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const models = await modelManager.listModels();
    const stats = await resourceManager.getStats();
    const activeModel = modelManager.getActiveModel();
    res.json({
      models,
      activeModel,
      resourceStats: stats,
      library: {
        total: models.length,
        installed: models.filter((model) => model.installed).length,
        active: activeModel,
        modelsRoot: modelManager.getModelsRoot()
      },
      storage: modelManager.getStoragePreferences()
    });
  });

  router.post('/pull', async (req, res) => {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }
    try {
      const download = modelManager.queueModelDownload(model);
      res.status(202).json({ download });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/storage', async (req, res) => {
    const modelsRoot = req.body?.modelsRoot;
    try {
      const storage = await modelManager.setModelsRoot(modelsRoot);
      const models = await modelManager.listModels();
      res.json({
        storage,
        models,
        activeModel: modelManager.getActiveModel()
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/select', async (req, res) => {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }
    await modelManager.setActiveModel(model);
    res.json({ activeModel: model });
  });

  router.post('/delete', async (req, res) => {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }
    await modelManager.deleteModel(model);
    res.json({ deleted: model });
  });

  return router;
}

module.exports = createModelRouter;
