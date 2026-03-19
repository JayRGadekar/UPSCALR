const express = require('express');
const { randomUUID } = require('node:crypto');

function createChatRouter({ modelManager, chatBroadcaster }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { prompt, model, history = [] } = req.body;
    const conversationId = randomUUID();
    const activeModel = model || modelManager.getActiveModel();

    const payload = {
      conversationId,
      model: activeModel,
      prompt,
      history
    };

    chatBroadcaster.emit('chat-request', payload);

    res.json({
      conversationId,
      model: activeModel,
      message: 'chat request queued'
    });
  });

  return router;
}

module.exports = createChatRouter;
