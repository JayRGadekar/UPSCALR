const express = require('express');

function createModelRouter({ modelManager, resourceManager }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const models = await modelManager.listModels();
    const stats = await resourceManager.getStats();
    res.json({
      models,
      activeModel: modelManager.getActiveModel(),
      resourceStats: stats,
      recommendation: modelManager.getModelMetadata(resourceManager.suggestModel(models)?.name)
    });
  });

  router.post('/pull', async (req, res) => {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }
    const metadata = await modelManager.pullModel(model);
    res.json({ model: metadata });
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
