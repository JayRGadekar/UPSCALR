import clsx from 'clsx';

const Sidebar = ({ items, active, onSelect }) => {
  return (
    <nav className="w-60 bg-black border-r border-gray-800 h-full flex flex-col">
      <div className="px-6 py-4 text-sm uppercase tracking-wide text-gray-500">AI Upscaler</div>
      <div className="flex-1 space-y-1 px-4">
        {items.map((item) => (
          <button
            key={item.id}
            className={clsx(
              'w-full text-left rounded-xl px-4 py-2 transition',
              active === item.id
                ? 'bg-gray-900 text-white shadow-inner'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="px-4 pb-4 text-xs text-gray-600">
        Streaming chat + video queue ready
      </div>
    </nav>
  );
};

export default Sidebar;
