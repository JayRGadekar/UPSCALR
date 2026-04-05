import clsx from 'clsx';

const Sidebar = ({ items, active, onSelect }) => {
  return (
    <nav className="flex h-full w-60 flex-col border-r border-white/10 bg-black/15 backdrop-blur-xl">
      <div className="px-6 pb-4 pt-7">
        <p className="text-[0.68rem] uppercase tracking-[0.42em] text-slate-400">VLLAMA</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Local video AI.</h1>
      </div>
      <div className="flex-1 space-y-1 px-4">
        {items.map((item) => (
          <button
            key={item.id}
            className={clsx(
              'w-full rounded-2xl px-4 py-3 text-left text-sm transition',
              active === item.id
                ? 'bg-white text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.12)]'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="px-6 pb-6 text-xs text-slate-500">
        One runtime. Local only.
      </div>
    </nav>
  );
};

export default Sidebar;
