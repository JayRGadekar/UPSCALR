import { useMemo, useState } from 'react';

const VideoUpscalePanel = ({
  jobs = [],
  onStart,
  demoAssets = [],
  modelCatalog = [],
  selectedModel,
  onSelectModel,
  onEnsureModel,
  modelAvailability = new Set(),
  latestOutputPath
}) => {
  const [mediaType, setMediaType] = useState('video');
  const [factor, setFactor] = useState(2);
  const [inputPath, setInputPath] = useState('');
  const [useGpu, setUseGpu] = useState(true);

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setInputPath(file.path || file.name || '');
      setMediaType(file.type?.startsWith('image') ? 'image' : 'video');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const selectedModelMeta = useMemo(
    () => modelCatalog.find((item) => item.name === selectedModel) || {},
    [modelCatalog, selectedModel]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!inputPath || !selectedModel) {
      return;
    }
    onStart({ inputPath, factor, useGpu, model: selectedModel, mediaType });
  };

  const isModelInstalled = modelAvailability.has(selectedModel);

  return (
    <div className="flex h-full flex-col p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Media Upscale</h1>
          <p className="text-sm text-slate-400">
            Choose image or video, pick the factor, and stream a model-powered upscale job.
          </p>
        </div>
        <button
          onClick={handleSubmit}
          className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:bg-slate-700"
          disabled={!inputPath || !selectedModel}
        >
          Start
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {['video', 'image'].map((type) => (
          <button
            key={type}
            onClick={() => setMediaType(type)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              mediaType === type
                ? 'bg-slate-800 text-white'
                : 'border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            {type === 'video' ? 'Video' : 'Image'}
          </button>
        ))}
        <span className="text-xs uppercase tracking-wider text-slate-500">Mode</span>
      </div>

      <div className="mt-4 flex items-center gap-6 text-sm">
        <label className="flex items-center gap-2">
          Factor
          <select
            value={factor}
            onChange={(event) => setFactor(Number(event.target.value))}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-white"
          >
            {[2, 4].map((option) => (
              <option key={option} value={option}>
                {option}x
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-400">
          <input type="checkbox" checked={useGpu} onChange={() => setUseGpu((prev) => !prev)} />
          Use GPU
        </label>
        <span className="text-xs uppercase tracking-wider text-slate-500">Factor</span>
      </div>

      <form
        onSubmit={handleSubmit}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="mt-6 rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-6 text-sm text-slate-300"
      >
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-slate-500">
          Drop file or paste path
        </label>
        <input
          value={inputPath}
          onChange={(event) => setInputPath(event.target.value)}
          placeholder="/path/to/clip.mp4"
          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
        />
        <p className="mt-2 text-xs text-slate-500">
          Drag from Finder / Explorer (paths are captured when running inside Electron).
        </p>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-slate-500">Model</p>
          <select
            value={selectedModel}
            onChange={(event) => onSelectModel(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
          >
            {modelCatalog.map((model) => (
              <option key={model.name} value={model.name}>
                {model.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">{selectedModelMeta.description}</p>
        </div>
        <button
          type="button"
          onClick={() => onEnsureModel(selectedModel)}
          className="h-fit rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition hover:border-slate-700"
        >
          {isModelInstalled ? 'Downloaded' : 'Download'}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500">
        {demoAssets.map((asset) => (
          <button
            key={asset.path}
            type="button"
            onClick={() => {
              setInputPath(asset.path);
              setMediaType(asset.type);
            }}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-700"
          >
            <span>{asset.label}</span>
            <span className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">Demo</span>
          </button>
        ))}
      </div>

      {latestOutputPath && (
        <div className="mt-6 rounded-2xl border border-green-500/30 bg-slate-900 p-4 text-sm text-green-300">
          Done! Saved to <span className="font-semibold text-white">{latestOutputPath}</span>
        </div>
      )}

      <div className="mt-6 flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm">
        {jobs.length === 0 ? (
          <p className="text-slate-500">Queue is empty.</p>
        ) : (
          jobs.map((job) => (
            <div key={job.jobId} className="space-y-1 border-b border-slate-800 pb-3 last:border-none last:pb-0">
              <div className="flex items-center justify-between text-slate-400">
                <span>{job.payload?.inputPath || 'unknown'}</span>
                <span className="text-xs">{job.status}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${job.progress ?? 0}%` }}
                />
              </div>
              <div className="text-xs text-slate-500">
                Model: {job.payload?.model || 'default'} · Factor: {job.payload?.factor}x · GPU:{' '}
                {job.payload?.useGpu ? 'yes' : 'no'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VideoUpscalePanel;
