const LogsPanel = ({ logs = [] }) => {
  return (
    <div className="flex h-full flex-col p-8">
      <h1 className="text-2xl font-semibold">Logs</h1>
      <p className="text-sm text-slate-400">Observability for downloads, plugins, and queues.</p>
      <div className="mt-6 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
        {logs.length === 0 ? (
          <p className="text-slate-500">System logs will appear here.</p>
        ) : (
          logs.map((log, index) => (
            <div key={`${log}-${index}`} className="py-1">
              <div className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
              <p className="text-slate-200">{log.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogsPanel;
