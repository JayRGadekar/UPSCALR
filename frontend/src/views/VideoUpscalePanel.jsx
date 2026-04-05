import { useMemo, useState } from 'react';

const VideoUpscalePanel = ({
  jobs = [],
  onStart,
  currentModel,
  latestOutputPath
}) => {
  const [mediaType, setMediaType] = useState('video');
  const [factor, setFactor] = useState(currentModel?.supportedFactors?.[0] || 4);
  const [inputPath, setInputPath] = useState('');
  const [useGpu, setUseGpu] = useState(true);

  const queueSummary = useMemo(() => {
    const running = jobs.filter((job) => job.status === 'running').length;
    const completed = jobs.filter((job) => job.status === 'completed').length;
    return {
      total: jobs.length,
      running,
      completed
    };
  }, [jobs]);

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setInputPath(file.path || file.name || '');
      setMediaType(file.type?.startsWith('image') ? 'image' : 'video');
    }
  };

  const handleSubmit = (event) => {
    event?.preventDefault();
    if (!inputPath || !currentModel?.installed) {
      return;
    }

    onStart({
      inputPath,
      factor,
      useGpu,
      mediaType
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.38em] text-slate-400">Upscale</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Drop a file and run.</h2>
        </div>

        <button
          onClick={handleSubmit}
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
          disabled={!inputPath || !currentModel?.installed}
        >
          {currentModel?.installed ? 'Upscale now' : 'Install model first'}
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center gap-3">
            {['video', 'image'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMediaType(type)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mediaType === type
                    ? 'bg-cyan-300 text-slate-950'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {type === 'video' ? 'Video' : 'Image'}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            className="mt-5 rounded-[28px] border border-dashed border-cyan-300/20 bg-cyan-300/[0.04] p-5"
          >
            <label className="text-[0.68rem] uppercase tracking-[0.34em] text-slate-500">Input path</label>
            <input
              value={inputPath}
              onChange={(event) => setInputPath(event.target.value)}
              placeholder="/Users/you/Movies/source.mov"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-300/40 hover:border-white/20"
            />
          </form>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <span className="text-[0.68rem] uppercase tracking-[0.34em] text-slate-500">Scale</span>
              <select
                value={factor}
                onChange={(event) => setFactor(Number(event.target.value))}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
              >
                {(currentModel?.supportedFactors || [4]).map((option) => (
                  <option key={option} value={option}>
                    {option}x
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <span className="text-[0.68rem] uppercase tracking-[0.34em] text-slate-500">Mode</span>
              <button
                type="button"
                onClick={() => setUseGpu((prev) => !prev)}
                className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left text-white transition hover:border-cyan-300/30"
              >
                <span>{useGpu ? 'GPU' : 'CPU'}</span>
                <span className="text-xs uppercase tracking-[0.28em] text-slate-400">{useGpu ? 'Fast' : 'Fallback'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.34em] text-slate-500">Status</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-black/20 px-3 py-4">
                <div className="text-2xl font-semibold text-white">{queueSummary.total}</div>
                <div className="mt-1 text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">Total</div>
              </div>
              <div className="rounded-2xl bg-black/20 px-3 py-4">
                <div className="text-2xl font-semibold text-white">{queueSummary.running}</div>
                <div className="mt-1 text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">Running</div>
              </div>
              <div className="rounded-2xl bg-black/20 px-3 py-4">
                <div className="text-2xl font-semibold text-white">{queueSummary.completed}</div>
                <div className="mt-1 text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">Done</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.34em] text-slate-500">Output</p>
            <div className="mt-4 rounded-2xl bg-black/20 p-4 text-sm text-slate-300">
              {latestOutputPath || 'Nothing saved yet.'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.34em] text-slate-500">Queue</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Jobs</h3>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
              No jobs yet.
            </div>
          ) : (
            jobs.map((job) => (
              <article key={job.jobId} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{job.payload?.inputPath || 'unknown input'}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">{job.status}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{job.payload?.factor}x</div>
                    <div className="mt-1">{job.payload?.useGpu ? 'GPU' : 'CPU'}</div>
                  </div>
                </div>

                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-300 transition-all"
                    style={{ width: `${job.progress ?? 0}%` }}
                  />
                </div>
                {job.error && (
                  <p className="mt-3 text-xs text-rose-300">{job.error}</p>
                )}
                {job.logs?.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    {job.logs.slice(0, 2).map((line, index) => (
                      <p key={`${job.jobId}-${index}`}>{line}</p>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoUpscalePanel;
