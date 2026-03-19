const ModelPanel = ({
  models = [],
  recommendation,
  resourceStats,
  onPull,
  onSelect,
  onDelete,
  onRefresh
}) => {
  return (
    <div className="flex h-full flex-col p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Models</h1>
          <p className="text-sm text-slate-400">
            Manage Ollama models. Lazy-load keeps memory light.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-slate-700"
        >
          Refresh
        </button>
      </div>
      <div className="mt-6 space-y-3 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4">
        {resourceStats && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-200">
            <div>RAM: {(resourceStats.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB free</div>
            <div>GPU: {resourceStats.gpu?.name || 'detected automatically'}</div>
            <div>Recommendation: {recommendation?.name || 'loading...'}</div>
          </div>
        )}
        {models.map((model) => (
          <div key={model.name} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{model.name}</span>
              <div className="space-x-2">
                <button
                  onClick={() => onPull(model.name)}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-300 hover:bg-slate-800"
                >
                  Pull
                </button>
                <button
                  onClick={() => onSelect(model.name)}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-300 hover:bg-slate-800"
                >
                  Use
                </button>
                <button
                  onClick={() => onDelete(model.name)}
                  className="rounded-lg border border-red-600 px-3 py-1 text-xs uppercase tracking-wide text-red-300 hover:bg-red-700/20"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">Size: {model.size}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelPanel;
