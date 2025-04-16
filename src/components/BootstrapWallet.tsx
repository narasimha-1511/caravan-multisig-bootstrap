import { useWalletStore } from '../store/useWalletStore';

export const BootstrapWallet = () => {
  const { bootstrapWallet, loading, rpc, address, balance } = useWalletStore();

  const handleBootstrap = async () => {
    await bootstrapWallet();
  };

  if (!rpc.connected) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-gray-400">Connect to your Bitcoin node first to bootstrap the wallet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-medium text-white">Quick Bootstrap</h2>
      <p className="text-gray-300">
        This will automatically:
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Create a new 1-of-2 multisig wallet</li>
          <li>Generate test blocks</li>
          <li>Fund the wallet with test coins</li>
        </ul>
      </p>

      {address && (
        <div className="p-4 bg-slate-900 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Multisig Address</div>
          <div className="text-white font-mono break-all">{address}</div>
          {balance > 0 && (
            <div className="mt-2">
              <div className="text-sm text-gray-400 mb-1">Balance</div>
              <div className="text-white font-mono">{balance} BTC</div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleBootstrap}
        disabled={loading}
        className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Bootstrapping...' : 'Bootstrap Wallet'}
      </button>

      {rpc.error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {rpc.error}
        </div>
      )}
    </div>
  );
};
