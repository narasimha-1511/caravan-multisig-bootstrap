import { useWalletStore } from '../hooks/useWalletStore';

export const ModeSwitcher = () => {
  const { mode, setMode } = useWalletStore();

  return (
    <div className="backdrop-blur rounded-lg border border-slate-700/50 inline-flex gap-2 p-1">
      <button
        onClick={() => setMode('manual')}
        className={`px-4 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
          mode === 'manual'
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            : 'text-gray-300 hover:bg-slate-700'
        }`}
      >
        Manual Setup
      </button>
      <button
        onClick={() => setMode('bootstrap')}
        className={`px-4 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
          mode === 'bootstrap'
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            : 'text-gray-300 hover:bg-slate-700'
        }`}
      >
        Quick Bootstrap
      </button>
    </div>
  );
};
