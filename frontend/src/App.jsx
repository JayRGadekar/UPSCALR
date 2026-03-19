import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import VideoUpscalePanel from './views/VideoUpscalePanel';
import LogsPanel from './views/LogsPanel';

const PANEL_MAP = {
  generation: 'Generation',
  upscaler: 'Upscaler',
  logs: 'Logs'
};

const MODEL_CATALOG = [
  {
    name: 'realesrgan-x4',
    label: 'RealESRGAN x4',
    description: 'High-quality 4x upscaling'
  },
  {
    name: 'realesrgan-x2',
    label: 'RealESRGAN x2',
    description: 'Fast 2x upscaling'
  },
  {
    name: 'upscayl-x4',
    label: 'Upscayl x4',
    description: 'Advanced 4x with detail preservation'
  },
  {
    name: 'veadotnet-x4',
    label: 'VeaDoTNet x4',
    description: 'Video-optimized 4x upscaling'
  },
  {
    name: 'bsrgan-x4',
    label: 'BSRGAN x4',
    description: 'Blind super-resolution 4x'
  },
  {
    name: 'esrgan-x4',
    label: 'ESRGAN x4',
    description: 'Enhanced 4x upscaling'
  },
  {
    name: 'swinir-x4',
    label: 'SwinIR x4',
    description: 'Transformer-based 4x upscaling'
  }
];

const DEMO_ASSETS = [];

const App = () => {
  const [activePanel, setActivePanel] = useState('generation');
  const [modelsState, setModelsState] = useState({ models: [], recommendation: null, resourceStats: null });
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

  useEffect(() => {
    videoJobs.forEach((job) => {
      if (job.status === 'completed' && !completedVideoJobsRef.current.has(job.jobId)) {
        completedVideoJobsRef.current.add(job.jobId);
        appendLog(`Upscale saved to ${job.payload?.outputPath || 'Downloads'}`);
      }
    });
  }, [videoJobs, appendLog]);

  return (
    <div className="flex h-screen bg-black text-white">
      <Sidebar items={panelEntries} active={activePanel} onSelect={setActivePanel} />
      <div className="flex flex-1 flex-col overflow-hidden bg-black">
        <main className="flex-1 overflow-y-auto px-8 pb-10 pt-4">
          {activePanel === 'generation' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
              <section className="glass-panel flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Generation</p>
                    <h2 className="text-2xl font-semibold text-white">AI Upscaling</h2>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
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
                </div>
              </section>
              <section className="glass-panel flex flex-col gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-gray-500">System Info</p>
                  <h2 className="text-xl font-semibold text-white">Resources</h2>
                </div>
                <div className="flex flex-col gap-3 text-sm text-gray-300">
                  {modelsState.resourceStats ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-600">RAM Available</p>
                        <p className="text-lg font-semibold">{(modelsState.resourceStats.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">GPU</p>
                        <p className="text-lg font-semibold">{modelsState.resourceStats.gpu?.name || 'Auto-detected'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Recommended</p>
                        <p className="text-lg font-semibold">{modelsState.recommendation?.name || 'Loading...'}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-600">Gathering resource info…</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {activePanel === 'upscaler' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
              <section className="glass-panel flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Upscaler</p>
                    <h2 className="text-2xl font-semibold text-white">Media Processing</h2>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
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
                </div>
              </section>
              <section className="glass-panel flex flex-col gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Job Queue</p>
                  <h2 className="text-xl font-semibold text-white">Active Jobs</h2>
                </div>
                <div className="flex-1 overflow-auto rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm">
                  {videoJobs.length === 0 ? (
                    <p className="text-gray-600">No active jobs</p>
                  ) : (
                    <div className="space-y-4">
                      {videoJobs.slice(0, 5).map((job) => (
                        <div key={job.jobId} className="space-y-2 border-b border-gray-800 pb-3 last:border-none">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{job.payload?.inputPath?.split('/').pop() || 'unknown'}</span>
                            <span className="text-xs font-semibold text-gray-400">{job.status}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-800">
                            <div
                              className="h-full rounded-full bg-white transition-all"
                              style={{ width: `${job.progress ?? 0}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-600">
                            {job.payload?.factor}x · {job.payload?.useGpu ? 'GPU' : 'CPU'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activePanel === 'logs' && (
            <section className="glass-panel flex flex-col gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">System Logs</p>
                <h2 className="text-2xl font-semibold text-white">Event Monitor</h2>
              </div>
              <div className="flex-1 overflow-auto rounded-2xl border border-gray-800 bg-gray-950 p-4 text-xs">
                {logs.length === 0 ? (
                  <p className="text-gray-600">System logs will appear here</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={`${log}-${index}`} className="space-y-1 border-b border-gray-800 py-2 last:border-none">
                      <div className="flex items-center justify-between text-gray-600">
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-gray-300">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
