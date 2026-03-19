import clsx from 'clsx';

const Sidebar = ({ items, active, onSelect }) => {
  return (
    <nav className="w-60 bg-slate-950 border-r border-slate-800 h-full flex flex-col">
      <div className="px-6 py-4 text-sm uppercase tracking-wide text-slate-400">AI Upscaler</div>
      <div className="flex-1 space-y-1 px-4">
        {items.map((item) => (
          <button
            key={item.id}
            className={clsx(
              'w-full text-left rounded-xl px-4 py-2 transition',
              active === item.id
                ? 'bg-slate-800 text-white shadow-inner'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            )}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="px-4 pb-4 text-xs text-slate-500">
        Streaming chat + video queue ready
      </div>
    </nav>
  );
};

export default Sidebar;
