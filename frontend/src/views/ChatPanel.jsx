import { useEffect, useState } from 'react';

const ChatPanel = ({ messages = [], models = [], onSend }) => {
  const [prompt, setPrompt] = useState('');
  const [modelOverride, setModelOverride] = useState(models[0]?.name || '');

  useEffect(() => {
    if (models.length && !modelOverride) {
      setModelOverride(models[0].name);
    }
  }, [models, modelOverride]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }
    onSend({
      prompt: prompt.trim(),
      model: modelOverride
    });
    setPrompt('');
  };

  return (
    <div className="flex h-full flex-col py-6 px-8">
      <h1 className="text-2xl font-semibold text-white">Chat</h1>
      <p className="text-sm text-slate-400">
        Streaming from Ollama. Choose a model per chat or follow the system suggestion.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <label className="text-xs uppercase tracking-wider text-slate-500">Model</label>
        <select
          value={modelOverride}
          onChange={(event) => setModelOverride(event.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-white outline-none"
        >
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-6 flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Send a prompt to start streaming.</p>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.conversationId}-${index}`} className="space-y-1 py-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {message.model || 'assistant'}
              </div>
              <p className="text-sm leading-relaxed text-slate-100">{message.text}</p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <input
          className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
          placeholder="Ask Ollama (llama3, mistral, codellama...)"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
