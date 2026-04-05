import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import VideoUpscalePanel from './views/VideoUpscalePanel';
import LogsPanel from './views/LogsPanel';

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:4000' : '';

const PANEL_MAP = {
  upscaler: 'Upscale',
  logs: 'Logs'
};

const apiFetch = (path, options) => fetch(`${API_BASE}${path}`, options);

const App = () => {
  const [activePanel, setActivePanel] = useState('upscaler');
  const [modelsState, setModelsState] = useState({
    models: [],
    resourceStats: null,
    activeModel: null,
    library: null,
    storage: null
  });
  const [videoJobs, setVideoJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const completedVideoJobsRef = useRef(new Set());

  const panelEntries = useMemo(
    () => Object.entries(PANEL_MAP).map(([id, label]) => ({ id, label })),
    []
  );

  const currentModel = modelsState.models[0] || null;
  const latestCompletedOutput = useMemo(() => {
    const completed = [...videoJobs].find((job) => job.status === 'completed');
    return completed?.payload?.outputPath ?? null;
  }, [videoJobs]);
  const hasDownloadInFlight = Boolean(currentModel?.download?.status === 'downloading');
  const storageReady = Boolean(modelsState.storage?.configured);

  const appendLog = useCallback((message) => {
    setLogs((prev) => [{ message, timestamp: Date.now() }, ...prev]);
  }, []);

  const applyModelsPayload = useCallback((payload) => {
    setModelsState({
      models: payload.models || [],
      resourceStats: payload.resourceStats || null,
      activeModel: payload.activeModel || null,
      library: payload.library || null,
      storage: payload.storage || null
    });
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const response = await apiFetch('/models');
      const payload = await response.json();
      applyModelsPayload(payload);
      return payload;
    } catch (error) {
      appendLog(`Failed to refresh runtime: ${error.message}`);
      return null;
    }
  }, [appendLog, applyModelsPayload]);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    if (!hasDownloadInFlight) {
      return undefined;
    }

    const interval = setInterval(() => {
      refreshModels();
    }, 1200);

    return () => clearInterval(interval);
  }, [hasDownloadInFlight, refreshModels]);

  const configureModelsFolder = useCallback(async (modelsRoot) => {
    try {
      const response = await apiFetch('/models/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modelsRoot })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not save model folder');
      }

      appendLog(`Models folder set to ${payload.storage.modelsRoot}`);
      await refreshModels();
    } catch (error) {
      appendLog(`Could not set model folder: ${error.message}`);
    }
  }, [appendLog, refreshModels]);

  const handleChooseFolder = useCallback(async () => {
    const picked = await window.vllama?.chooseDirectory?.();
    if (picked) {
      await configureModelsFolder(picked);
      return;
    }

    const fallback = window.prompt('Paste the model folder path', modelsState.storage?.recommendedRoot || '');
    if (fallback) {
      await configureModelsFolder(fallback);
    }
  }, [configureModelsFolder, modelsState.storage?.recommendedRoot]);

  const handleUseRecommendedFolder = useCallback(async () => {
    if (!modelsState.storage?.recommendedRoot) {
      return;
    }
    await configureModelsFolder(modelsState.storage.recommendedRoot);
  }, [configureModelsFolder, modelsState.storage?.recommendedRoot]);

  const handleInstallModel = useCallback(async () => {
    if (!currentModel?.name) {
      return;
    }

    try {
      const response = await apiFetch('/models/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: currentModel.name })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Install failed');
      }
      appendLog(`Started download for ${currentModel.label}`);
      await refreshModels();
    } catch (error) {
      appendLog(`Could not install ${currentModel.label}: ${error.message}`);
    }
  }, [appendLog, currentModel, refreshModels]);

  const handleDeleteModel = useCallback(async () => {
    if (!currentModel?.name) {
      return;
    }

    const confirmed = window.confirm(`Delete ${currentModel.label} from this folder?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch('/models/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: currentModel.name })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Delete failed');
      }
      appendLog(`Deleted ${currentModel.label}. You can now change the folder and reinstall it.`);
      await refreshModels();
    } catch (error) {
      appendLog(`Could not delete ${currentModel.label}: ${error.message}`);
    }
  }, [appendLog, currentModel, refreshModels]);

  const handleStartVideo = useCallback(async (payload) => {
    if (!currentModel?.installed) {
      appendLog('Install Real-ESRGAN before starting a job.');
      return;
    }

    try {
      const response = await apiFetch('/video/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          model: currentModel.name,
          metadata: {
            ...(payload.metadata || {}),
            modelLabel: currentModel.label
          }
        })
      });
      const job = await response.json();
      if (!response.ok) {
        throw new Error(job.error || 'Queue failed');
      }
      setVideoJobs((prev) => [{ ...job, progress: 0 }, ...prev]);
      appendLog(`Queued ${payload.mediaType} upscale for ${payload.inputPath}`);
    } catch (error) {
      appendLog(`Queue failed: ${error.message}`);
    }
  }, [appendLog, currentModel]);

  useEffect(() => {
    if (videoJobs.length === 0) {
      return undefined;
    }

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        videoJobs.map(async (job) => {
          try {
            const response = await apiFetch(`/video/status?jobId=${job.jobId}`);
            if (!response.ok) {
              return job;
            }
            const payload = await response.json();
            return {
              ...job,
              status: payload.status,
              progress: payload.progress ?? job.progress,
              payload: payload.payload || job.payload,
              logs: payload.logs || job.logs,
              error: payload.error || job.error
            };
          } catch (error) {
            return job;
          }
        })
      );
      setVideoJobs(updated);
    }, 2500);

    return () => clearInterval(interval);
  }, [videoJobs]);

  useEffect(() => {
    videoJobs.forEach((job) => {
      if (job.status === 'completed' && !completedVideoJobsRef.current.has(job.jobId)) {
        completedVideoJobsRef.current.add(job.jobId);
        appendLog(`Saved output to ${job.payload?.outputPath || 'Downloads'}`);
      }
    });
  }, [appendLog, videoJobs]);

  return (
    <div className="flex h-screen bg-app text-white">
      <Sidebar items={panelEntries} active={activePanel} onSelect={setActivePanel} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-white/10 px-8 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] uppercase tracking-[0.42em] text-slate-400">VLLAMA</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">One local upscaler.</h1>
            </div>

            <div className="glass-toolbar w-full max-w-md rounded-[28px] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Model</p>
                  <p className="mt-1 text-lg font-semibold text-white">{currentModel?.label || 'Real-ESRGAN'}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  {currentModel?.download?.status === 'downloading'
                    ? `${currentModel.download.progress || 0}%`
                    : currentModel?.installed ? 'Installed' : storageReady ? 'Not installed' : 'Setup needed'}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {(currentModel?.supportedFactors || [4]).join('/')}x
                </span>
                {modelsState.resourceStats?.gpu?.name && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    GPU: {modelsState.resourceStats.gpu.name}
                  </span>
                )}
                {storageReady && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {modelsState.storage?.modelsRoot}
                  </span>
                )}
              </div>
              {currentModel?.download?.status === 'downloading' && (
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-300 transition-all"
                    style={{ width: `${currentModel.download.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 pb-8 pt-6">
          {activePanel === 'upscaler' && (
            <>
              {!storageReady && (
                <section className="glass-panel mb-6 max-w-3xl">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.36em] text-slate-500">Setup</p>
                      <h2 className="mt-2 text-3xl font-semibold text-white">Pick a model folder.</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                        VLLAMA keeps one local Real-ESRGAN runtime. Choose the folder once, and the app will check whether it is already installed there.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleUseRecommendedFolder}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                      >
                        Use recommended
                      </button>
                      <button
                        type="button"
                        onClick={handleChooseFolder}
                        className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                      >
                        Choose folder
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                    {modelsState.storage?.recommendedRoot || 'No recommended path yet.'}
                  </div>
                </section>
              )}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <section className="glass-panel min-h-[620px]">
                  <VideoUpscalePanel
                    jobs={videoJobs}
                    onStart={handleStartVideo}
                    currentModel={currentModel}
                    latestOutputPath={latestCompletedOutput}
                  />
                </section>

                <section className="space-y-5">
                  <div className="glass-panel">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.34em] text-slate-500">Runtime</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">{currentModel?.label || 'Real-ESRGAN x4+'}</h2>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                        {currentModel?.download?.status === 'downloading'
                          ? 'Downloading'
                          : currentModel?.installed ? 'Ready' : 'Install'}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3 text-sm text-slate-300">
                      <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <div className="text-[0.68rem] uppercase tracking-[0.32em] text-slate-500">Folder</div>
                        <div className="mt-2 break-all text-white">
                          {modelsState.storage?.modelsRoot || modelsState.storage?.recommendedRoot || 'Choose a folder'}
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <div className="text-[0.68rem] uppercase tracking-[0.32em] text-slate-500">Source</div>
                        <div className="mt-2 text-white">Official GitHub release runtime</div>
                      </div>
                    </div>

                    {currentModel?.download?.status === 'downloading' && (
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-xs text-cyan-100">
                          <span>Download progress</span>
                          <span>{currentModel.download.progress || 0}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-300 transition-all"
                            style={{ width: `${currentModel.download.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {currentModel?.download?.status === 'failed' && (
                      <p className="mt-4 text-sm text-rose-300">{currentModel.download.error || 'Download failed.'}</p>
                    )}

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={handleInstallModel}
                        disabled={!storageReady || currentModel?.download?.status === 'downloading'}
                        className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
                      >
                        {currentModel?.download?.status === 'downloading'
                          ? `Downloading ${currentModel.download.progress || 0}%`
                          : currentModel?.installed ? 'Reinstall model' : 'Install model'}
                      </button>
                      <button
                        type="button"
                        onClick={handleChooseFolder}
                        className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                      >
                        Change folder
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteModel}
                        disabled={!currentModel?.installed || currentModel?.download?.status === 'downloading'}
                        className="rounded-full border border-rose-300/20 bg-rose-300/10 px-5 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40"
                      >
                        Delete model
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}

          {activePanel === 'logs' && (
            <section className="glass-panel min-h-[480px]">
              <LogsPanel logs={logs} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
