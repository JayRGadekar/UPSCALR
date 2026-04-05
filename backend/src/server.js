require('dotenv').config();

const express = require('express');
const http = require('node:http');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const EventEmitter = require('node:events');

const ModelManager = require('./services/modelManager');
const ResourceManager = require('./services/resourceManager');
const VideoQueue = require('./services/videoQueue');
const PluginRegistry = require('./services/pluginRegistry');
const createModelRouter = require('./routes/models');
const createChatRouter = require('./routes/chat');
const createVideoRouter = require('./routes/video');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const modelManager = new ModelManager();
const resourceManager = new ResourceManager();
const videoQueue = new VideoQueue();
const pluginRegistry = new PluginRegistry();
const chatBroadcaster = new EventEmitter();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/plugins', (req, res) => {
  res.json({ plugins: pluginRegistry.list() });
});

app.use('/models', createModelRouter({ modelManager, resourceManager }));
app.use('/chat', createChatRouter({ modelManager, chatBroadcaster }));
app.use('/video', createVideoRouter({ videoQueue, modelManager }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/chat-stream' });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'ready', timestamp: Date.now() }));
  const handler = (message) => {
    ws.send(JSON.stringify({ type: 'chat-response', payload: message }));
  };

  chatBroadcaster.on('chat-response', handler);

  ws.on('close', () => {
    chatBroadcaster.off('chat-response', handler);
  });
});

chatBroadcaster.on('chat-request', (payload) => {
  const { conversationId, prompt, model } = payload;
  let chunk = 0;
  const maxChunks = 5;

  const streamInterval = setInterval(() => {
    chunk += 1;
    const text = `Streaming chunk ${chunk} for ${prompt}`;
    chatBroadcaster.emit('chat-response', {
      conversationId,
      model,
      text,
      done: chunk >= maxChunks
    });
    if (chunk >= maxChunks) {
      clearInterval(streamInterval);
    }
  }, 250);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend API listening on http://localhost:${PORT}`);
});
