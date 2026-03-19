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
          <p className="text-sm text-gray-500">
            Manage Ollama models. Lazy-load keeps memory light.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-700 hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>
      <div className="mt-6 space-y-3 overflow-auto rounded-2xl border border-gray-800 bg-gray-950 p-4">
        {resourceStats && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
            <div>RAM: {(resourceStats.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB free</div>
            <div>GPU: {resourceStats.gpu?.name || 'detected automatically'}</div>
            <div>Recommendation: {recommendation?.name || 'loading...'}</div>
          </div>
        )}
        {models.map((model) => (
          <div key={model.name} className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{model.name}</span>
              <div className="space-x-2">
                <button
                  onClick={() => onPull(model.name)}
                  className="rounded-lg border border-gray-700 px-3 py-1 text-xs uppercase tracking-wide text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                >
                  Pull
                </button>
                <button
                  onClick={() => onSelect(model.name)}
                  className="rounded-lg border border-gray-700 px-3 py-1 text-xs uppercase tracking-wide text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                >
                  Use
                </button>
                <button
                  onClick={() => onDelete(model.name)}
                  className="rounded-lg border border-gray-700 px-3 py-1 text-xs uppercase tracking-wide text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600">Size: {model.size}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelPanel;
