import { useState } from 'react';
import { useWalletStore } from '../store/walletStore';

export const RpcConnectionBox = () => {
  const { rpc, setRpc, testConnection } = useWalletStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    try {
      setLoading(true);
      await testConnection();
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-slate-800 rounded-xl shadow-xl z-50 border border-slate-700">
      <div 
        className="p-4 cursor-pointer flex justify-between items-center text-white hover:bg-slate-700 rounded-t-xl transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-medium">RPC Connection</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{rpc.connected ? 'Connected' : 'Disconnected'}</span>
          <span className={`h-3 w-3 rounded-full ${rpc.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-3 border-t border-slate-700">
          {rpc.error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {rpc.error}
            </div>
          )}
          <input
            type="text"
            placeholder="Host"
            value={rpc.host}
            onChange={(e) => setRpc({ host: e.target.value })}
            className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Port"
            value={rpc.port}
            onChange={(e) => setRpc({ port: e.target.value })}
            className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Username"
            value={rpc.username}
            onChange={(e) => setRpc({ username: e.target.value })}
            className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={rpc.password}
            onChange={(e) => setRpc({ password: e.target.value })}
            className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Connect to Node'}
          </button>
        </div>
      )}
    </div>
  );
};
