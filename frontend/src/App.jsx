import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './views/ChatPanel';
import ModelPanel from './views/ModelPanel';
import VideoUpscalePanel from './views/VideoUpscalePanel';
import LogsPanel from './views/LogsPanel';

const PANEL_MAP = {
  chat: 'Chat',
  models: 'Models',
  video: 'Video Upscale',
  logs: 'Logs'
};

const MODEL_CATALOG = [
  {
    name: 'llama3-mini',
    label: 'LLaMA3 Mini (chat/code)',
    description: '8B, optimized for 8GB RAM'
  },
  {
    name: 'mistral-7b',
    label: 'Mistral 7B',
    description: 'General purpose inference'
  },
  {
    name: 'codellama-7b-instruct',
    label: 'CodeLlama 7B Instruct',
    description: 'Coding-focused assistant'
  }
];

const DEMO_ASSETS = [
  { label: 'Beach Sunset (video)', path: '/Users/Shared/Demos/beach_sunset.mp4', type: 'video' },
  { label: 'Interview Clip (video)', path: '/Users/Shared/Demos/interview_clip.mp4', type: 'video' },
  { label: 'Product Shot (image)', path: '/Users/Shared/Demos/product_shot.png', type: 'image' }
];

const App = () => {
  const [activePanel, setActivePanel] = useState('chat');
  const [modelsState, setModelsState] = useState({ models: [], recommendation: null, resourceStats: null });
  const [chatMessages, setChatMessages] = useState([]);
  const [videoJobs, setVideoJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedVideoModel, setSelectedVideoModel] = useState(MODEL_CATALOG[0]?.name || '');
  const completedVideoJobsRef = useRef(new Set());
  const modelInstallationSet = useMemo(
    () => new Set(modelsState.models.map((model) => model.name)),
    [modelsState.models]
  );
  const latestCompletedOutput = useMemo(() => {
    const completed = [...videoJobs].find((job) => job.status === 'completed');
    return completed?.payload?.outputPath ?? null;
  }, [videoJobs]);

  const panelEntries = useMemo(
    () =>
      Object.entries(PANEL_MAP).map(([id, label]) => ({
        id,
        label
      })),
    []
  );

  const appendLog = useCallback((message) => {
    setLogs((prev) => [
      ...prev,
      {
        message,
        timestamp: Date.now()
      }
    ]);
  }, []);

  const refreshModels = async () => {
    try {
      const response = await fetch('/models');
      const payload = await response.json();
      setModelsState({
        models: payload.models || [],
        resourceStats: payload.resourceStats,
        recommendation: payload.recommendation
      });
    } catch (err) {
      appendLog(`Failed to refresh models: ${err.message}`);
    }
  };

  useEffect(() => {
    refreshModels();
  }, []);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:4000/chat-stream');

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat-response') {
          setChatMessages((prev) => [...prev, data.payload]);
        }
      } catch (err) {
        appendLog(`WebSocket parse error: ${err.message}`);
      }
    });

    socket.addEventListener('open', () => appendLog('Connected to chat stream'));
    socket.addEventListener('close', () => appendLog('Chat stream closed'));
    socket.addEventListener('error', (err) => appendLog(`Chat stream error: ${err.message}`));

    return () => socket.close();
  }, []);

  useEffect(() => {
    videoJobs.forEach((job) => {
      if (job.status === 'completed' && !completedVideoJobsRef.current.has(job.jobId)) {
        completedVideoJobsRef.current.add(job.jobId);
        appendLog(`Upscale saved to ${job.payload?.outputPath || 'Downloads'}`);
      }
    });
  }, [videoJobs, appendLog]);

  const handleChatSend = async ({ prompt, model }) => {
    try {
      await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          model
        })
      });
      appendLog(`Prompt queued on ${model || 'default model'}`);
    } catch (err) {
      appendLog(`Chat request failed: ${err.message}`);
    }
  };

  const handlePullModel = async (modelName) => {
    await fetch('/models/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: modelName })
    });
    appendLog(`Started pulling ${modelName}`);
    refreshModels();
  };

  const handleStartVideo = async (payload) => {
    const installed = modelsState.models.some((model) => model.name === payload.model);
    if (!installed) {
      await handlePullModel(payload.model);
    }
    await handleUpload(payload);
  };

  const handleSelectModel = async (modelName) => {
    await fetch('/models/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName })
    });
    appendLog(`Switched active model to ${modelName}`);
  };

  const handleDeleteModel = async (modelName) => {
    await fetch('/models/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName })
    });
    appendLog(`Deleted ${modelName}`);
    refreshModels();
  };

  const handleUpload = async ({ inputPath, factor, useGpu, model, mediaType }) => {
    try {
      const response = await fetch('/video/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputPath, factor, useGpu, model, mediaType })
      });
      const job = await response.json();
      setVideoJobs((prev) => [
        { ...job, payload: { ...(job.payload || {}), inputPath, factor, useGpu, model, mediaType }, progress: 0 },
        ...prev
      ]);
      appendLog(`Uploaded job for ${inputPath}`);
    } catch (err) {
      appendLog(`Video queue failed: ${err.message}`);
    }
  };

  useEffect(() => {
    if (videoJobs.length === 0) {
      return;
    }
    const interval = setInterval(async () => {
      const updated = await Promise.all(
        videoJobs.map(async (job) => {
          try {
            const response = await fetch(`/video/status?jobId=${job.jobId}`);
            if (!response.ok) {
              return job;
            }
            const payload = await response.json();
            return {
              ...job,
              status: payload.status,
              progress: payload.progress ?? job.progress,
              payload: payload.payload || job.payload
            };
          } catch (error) {
            return job;
          }
        })
      );
      setVideoJobs(updated);
    }, 3500);
    return () => clearInterval(interval);
  }, [videoJobs]);

  const panelContent = {
    chat: (
      <ChatPanel messages={chatMessages} models={modelsState.models} onSend={handleChatSend} />
    ),
    models: (
      <ModelPanel
        models={modelsState.models}
        recommendation={modelsState.recommendation}
        resourceStats={modelsState.resourceStats}
        onPull={handlePullModel}
        onSelect={handleSelectModel}
        onDelete={handleDeleteModel}
        onRefresh={refreshModels}
      />
    ),
    video: (
      <VideoUpscalePanel
        jobs={videoJobs}
        onStart={handleStartVideo}
        demoAssets={DEMO_ASSETS}
        modelCatalog={MODEL_CATALOG}
        selectedModel={selectedVideoModel}
        onSelectModel={setSelectedVideoModel}
        onEnsureModel={handlePullModel}
        modelAvailability={modelInstallationSet}
        latestOutputPath={latestCompletedOutput}
      />
    ),
    logs: <LogsPanel logs={logs} />
  };

  return (
    <div className="flex h-screen">
      <Sidebar items={panelEntries} active={activePanel} onSelect={setActivePanel} />
      <div className="flex flex-1 flex-col bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-8 py-4 text-xs uppercase tracking-[0.3em] text-slate-500">
          <span>{PANEL_MAP[activePanel]}</span>
          <span>Desktop · Ollama · Video</span>
        </div>
        <div className="flex-1">{panelContent[activePanel]}</div>
      </div>
    </div>
  );
};

export default App;
