import { useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { callRpc } from '../utils/rpc';

interface WalletInfo {
  name: string;
  created: boolean;
  descriptor?: string;
  fingerprint?: string;
  path?: string;
}

export const BootstrapWallet = () => {
  const { rpc } = useWalletStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([
    { name: 'reg_signer1', created: false },
    { name: 'reg_signer2', created: false }
  ]);

  const steps = [
    { id: 'wallets', title: 'Create Wallets', description: 'Create signing wallets' },
    { id: 'descriptors', title: 'Get Descriptors', description: 'Retrieve wallet descriptors' },
    { id: 'multisig', title: 'Setup Multisig', description: 'Configure multisig wallet' }
  ];

  const createWallets = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const wallet of wallets) {
        try {
          await callRpc('createwallet', [wallet.name, false, true], {
            url: rpc.host,
            port: rpc.port,
            username: rpc.username,
            password: rpc.password
          });
          setWallets(prev => prev.map(w => 
            w.name === wallet.name ? { ...w, created: true } : w
          ));
        } catch (err: any) {
          if (err.message.includes('already exists')) {
            setWallets(prev => prev.map(w => 
              w.name === wallet.name ? { ...w, created: true } : w
            ));
          } else {
            throw err;
          }
        }
      }
      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallets');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWallet = () => {
    const newName = `reg_signer${wallets.length + 1}`;
    setWallets(prev => [...prev, { name: newName, created: false }]);
  };

  const handleRemoveWallet = (index: number) => {
    if (wallets.length > 2) {
      setWallets(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleWalletNameChange = (index: number, newName: string) => {
    setWallets(prev => prev.map((wallet, i) => 
      i === index ? { ...wallet, name: newName } : wallet
    ));
  };

  if (!rpc.connected) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-gray-400">Connect to your Bitcoin node first to bootstrap the wallet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-medium text-white">Bootstrap Multisig Wallet</h2>
      
      {/* Stepper */}
      <div className="flex justify-between items-center">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                index === currentStep ? 'border-blue-500 bg-blue-500/20 text-blue-500' :
                index < currentStep ? 'border-green-500 bg-green-500 text-white' :
                'border-gray-600 text-gray-600'
              }`}>
                {index < currentStep ? (
                  <span>✓</span>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="mt-2 text-sm text-center">
                <div className={index === currentStep ? 'text-blue-500' : 'text-gray-400'}>
                  {step.title}
                </div>
                <div className="text-gray-500 text-xs">{step.description}</div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-full h-[2px] mx-4 ${
                index < currentStep ? 'bg-green-500' : 'bg-gray-600'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="mt-8">
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Signing Wallets</h3>
              <button
                onClick={handleAddWallet}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Add Wallet
              </button>
            </div>
            <div className="space-y-3">
              {wallets.map((wallet, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg">
                  <input
                    type="text"
                    value={wallet.name}
                    onChange={(e) => handleWalletNameChange(index, e.target.value)}
                    disabled={wallet.created}
                    className="flex-1 p-2 bg-slate-800 text-white border border-slate-700 rounded focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  />
                  {wallet.created ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    wallets.length > 2 && (
                      <button
                        onClick={() => handleRemoveWallet(index)}
                        className="text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={createWallets}
              disabled={loading}
              className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Creating Wallets...' : 'Create Wallets'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};
