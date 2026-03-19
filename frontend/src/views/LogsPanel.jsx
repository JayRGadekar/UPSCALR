const LogsPanel = ({ logs = [] }) => {
  return (
    <div className="flex h-full flex-col p-8">
      <h1 className="text-2xl font-semibold">Logs</h1>
      <p className="text-sm text-gray-500">Observability for downloads, plugins, and queues.</p>
      <div className="mt-6 overflow-auto rounded-2xl border border-gray-800 bg-gray-950 p-4 text-xs">
        {logs.length === 0 ? (
          <p className="text-gray-600">System logs will appear here.</p>
        ) : (
          logs.map((log, index) => (
            <div key={`${log}-${index}`} className="py-1">
              <div className="text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</div>
              <p className="text-gray-300">{log.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogsPanel;
