import { useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { callRpc } from '../utils/rpc';
import { 
  generateMultisigFromPublicKeys, 
  Network as BitcoinNetwork,
  deriveChildPublicKey,
} from '@caravan/bitcoin';
import { Buffer } from 'buffer';

interface WalletInfo {
  name: string;
  created: boolean;
  loading?: boolean;
  error?: string;
  descriptor?: string;
  fingerprint?: string;
  path?: string;
  xpub?: string;
  bip32Path?: string;
  descriptorDetails?: {
    desc: string;
    active: boolean;
    internal: boolean;
    timestamp?: string;
  }[];
}

interface MultisigConfig {
  requiredSigners: number;
  network: 'regtest' | 'testnet' | 'mainnet';
  addressType: 'p2sh-p2wsh';
  signers: Array<{
    fingerprint: string;
    xpub: string;
    bip32Path: string;
  }>;
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

  const [multisigConfig, setMultisigConfig] = useState<MultisigConfig>({
    requiredSigners: 2,
    network: 'regtest',
    addressType: 'p2sh-p2wsh',
    signers: []
  });

  const [depositAddress, setDepositAddress] = useState<string>('');
  const [isMining, setIsMining] = useState(false);
  const [fundingAmount, setFundingAmount] = useState(1); // Default 1 BTC

  const steps = [
    { id: 'wallets', title: 'Create Wallets', description: 'Create signing wallets' },
    { id: 'descriptors', title: 'Get Descriptors', description: 'Retrieve wallet descriptors' },
    { id: 'multisig', title: 'Setup Multisig', description: 'Configure multisig wallet' },
    { id: 'fund', title: 'Fund Wallet', description: 'Get deposit address' }
  ];

  const decodeDescriptor = (
    desc: string
  ): { bip32Path: string; fingerprint: string; xpub: string } => {
    // Match the descriptor inside the brackets []
    const match = desc.match(/\[([0-9a-fA-F]{8})(\/[0-9]+h\/[0-9]+h\/[0-9]+h)\]([a-zA-Z0-9]+)/);
  
    if (!match) {
      throw new Error("Invalid descriptor format");
    }
  
    const fingerprint = match[1]; // e.g., a7802b6e
    const bip32Path = match[2];   // e.g., /84h/1h/0h
    const xpub = match[3];        // e.g., tpub...
  
    return {
      bip32Path,
      fingerprint,
      xpub,
    };
  };
  

  const createWallets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First get list of all wallets
      const existingWallets = await callRpc('listwallets', [], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password
      });

      for (const wallet of wallets) {
        setWallets(prev => prev.map(w => 
          w.name === wallet.name ? { ...w, loading: true, error: undefined } : w
        ));

        try {
          if (existingWallets.includes(wallet.name)) {
            // Wallet exists, check if it's loaded
            let walletNeedsLoading = false;
            try {
              // Try to get wallet info to see if it's loaded
              await callRpc('getwalletinfo', [], {
                url: rpc.host,
                port: rpc.port,
                username: rpc.username,
                password: rpc.password,
                wallet: wallet.name
              });
            } catch (err) {
              walletNeedsLoading = true;
            }

            if (walletNeedsLoading) {
              // Load wallet if it exists but isn't loaded
              await callRpc('loadwallet', [wallet.name], {
                url: rpc.host,
                port: rpc.port,
                username: rpc.username,
                password: rpc.password
              });
            }

            // Get descriptors for existing wallet
            const descriptor = await callRpc('listdescriptors', [], {
              url: rpc.host,
              port: rpc.port,
              username: rpc.username,
              password: rpc.password,
              wallet: wallet.name
            });

            const _descriptor = descriptor.descriptors?.filter((d: any) => d.internal === false).find((d: any) => d.desc.startsWith('sh(wpkh('));
            if (_descriptor) {
              const { bip32Path, fingerprint, xpub } = decodeDescriptor(_descriptor.desc);
              setWallets(prev => prev.map(w => 
                w.name === wallet.name ? {
                  ...w,
                  created: true,
                  descriptor: _descriptor.desc,
                  fingerprint: fingerprint,
                  xpub: xpub,
                  bip32Path: bip32Path,
                  path: bip32Path.replace(/h/g, "'"),
                  loading: false,
                  error: undefined
                } : w
              ));
            } else {
              throw new Error('No valid descriptor found');
            }
          } else {
            // Wallet doesn't exist, create it
            try {
              await callRpc('createwallet', [wallet.name], {
                url: rpc.host,
                port: rpc.port,
                username: rpc.username,
                password: rpc.password
              });

              // Get descriptors after creating
              const descriptor = await callRpc('listdescriptors', [], {
                url: rpc.host,
                port: rpc.port,
                username: rpc.username,
                password: rpc.password,
                wallet: wallet.name
              });

              const _descriptor = descriptor.descriptors?.filter((d: any) => d.internal === false).find((d: any) => d.desc.startsWith('sh(wpkh('));
              if (_descriptor) {
                const { bip32Path, fingerprint, xpub } = decodeDescriptor(_descriptor.desc);
                setWallets(prev => prev.map(w => 
                  w.name === wallet.name ? {
                    ...w,
                    created: true,
                    descriptor: _descriptor.desc,
                    fingerprint: fingerprint,
                    xpub: xpub,
                    bip32Path: bip32Path,
                    path: bip32Path.replace(/h/g, "'"),
                    loading: false,
                    error: undefined
                  } : w
                ));
              } else {
                throw new Error('No valid descriptor found');
              }
            } catch (createErr: any) {
              setWallets(prev => prev.map(w => 
                w.name === wallet.name ? { ...w, loading: false, error: `Failed to create wallet: ${createErr.message}` } : w
              ));
              throw createErr;
            }
          }
        } catch (err: any) {
          setWallets(prev => prev.map(w => 
            w.name === wallet.name ? { ...w, loading: false, error: err.message } : w
          ));
        }
      }
      
      // Only proceed if we have at least 2 valid wallets with descriptors
      const validWallets = wallets.filter(w => w.created && w.descriptor);
      if (validWallets.length >= 2) {
        setCurrentStep(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup wallets');
    } finally {
      setLoading(false);
    }
  };

  const getWalletDescriptors = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const wallet of wallets) {
        if (!wallet.descriptor) {
          setWallets(prev => prev.map(w => 
            w.name === wallet.name ? { ...w, loading: true, error: undefined } : w
          ));

          try {
            // Get all descriptors for the wallet
            const descriptorInfo = await callRpc('listdescriptors', [], {
              url: rpc.host,
              port: rpc.port,
              username: rpc.username,
              password: rpc.password,
              wallet: wallet.name
            });

            // Find the sh(wpkh) descriptor that's active and not internal
            const targetDescriptor = descriptorInfo.descriptors.find(
              (d: any) => d.desc.startsWith('sh(wpkh') && d.active && !d.internal
            );

            if (!targetDescriptor) {
              throw new Error('No valid sh(wpkh) descriptor found');
            }

            // Extract fingerprint and xpub from descriptor
            const desc = targetDescriptor.desc;
            const fingerprintMatch = desc.match(/\[([a-f0-9]{8})(\/[0-9]+h\/[0-9]+h\/[0-9]+h)\]([a-zA-Z0-9]+)/);
            if (!fingerprintMatch) {
              throw new Error('Failed to extract xpub data from descriptor');
            }
            const fingerprint = fingerprintMatch[1]; // e.g., a7802b6e
            const bip32Path = fingerprintMatch[2];   // e.g., /84h/1h/0h
            const xpub = fingerprintMatch[3];        // e.g., tpub...

            setWallets(prev => prev.map(w => 
              w.name === wallet.name ? {
                ...w,
                loading: false,
                descriptor: targetDescriptor.desc,
                descriptorDetails: descriptorInfo.descriptors,
                fingerprint,
                xpub,
                path: bip32Path.replace(/h/g, "'"),
                bip32Path,
                error: undefined
              } : w
            ));
          } catch (err: any) {
            setWallets(prev => prev.map(w => 
              w.name === wallet.name ? { ...w, loading: false, error: err.message } : w
            ));
            throw err;
          }
        }
      }
      
      // Only proceed if all wallets have valid descriptors
      const validWallets = wallets.filter(w => w.created && w.descriptor && w.fingerprint && w.xpub);
      if (validWallets.length >= 2) {
        setCurrentStep(2);
      } else {
        setError('At least 2 wallets must have valid descriptors with fingerprints and xpubs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get wallet descriptors');
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

  const handleNext = () => {
    if (currentStep === 0) {
      createWallets();
    } else if (currentStep === 1) {
      getWalletDescriptors();
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const exportConfig = async () => {
    try {
      setError(null);

      // Get descriptors for each wallet
      const walletDescriptors = await Promise.all(wallets.map(async wallet => {
        const descriptors = await callRpc('listdescriptors', [], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password,
          wallet: wallet.name
        });
        const descriptor = descriptors.descriptors.find((d: { desc: string }) => d.desc.includes('sh(wpkh('));
        if (!descriptor) {
          throw new Error(`No valid descriptor found for wallet ${wallet.name}`);
        }
        return descriptor;
      }));

      // Extract xpubs and fingerprints from descriptors
      const xpubData = await Promise.all(walletDescriptors.map(async (desc) => {
        // First get the parent descriptor
        const match = desc.desc.match(/\[([a-f0-9]{8})(\/[0-9]+h\/[0-9]+h\/[0-9]+h)\]([a-zA-Z0-9]+)/);
        if (!match) {
          throw new Error('Failed to extract xpub data from descriptor');
        }

        // Get the raw descriptor
        const rawDesc = await callRpc('getdescriptorinfo', [desc.desc], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });

        // Convert path to proper BIP32 format
        const pathParts = match[2].split('/').filter(Boolean);
        const formattedPath = `m/${pathParts.map((p: string) => p.replace('h', "'")).join('/')}`;

        return {
          xfp: match[1],
          path: formattedPath,
          xpub: rawDesc.descriptor.match(/\[(.*?)\](.*?)\//)[2] || match[3]
        };
      }));

      const config = {
        name: "Bitcoin Multisig Wallet",
        uuid: "",
        addressType: "P2WSH",
        chain: "regtest",
        client: {
          type: "private",
          url: `http://${rpc.host}:${rpc.port}`,
          username: rpc.username,
          password: rpc.password,
          walletName: "watcher"
        },
        quorum: {
          requiredSigners: multisigConfig.requiredSigners,
          totalSigners: wallets.length
        },
        extendedPublicKeys: xpubData.map((data, i) => ({
          name: `Extended Public Key ${i + 1}`,
          bip32Path: data.path,
          xpub: data.xpub,
          xfp: data.xfp,
          method: "text"
        })),
        startingAddressIndex: 0,
        addressExplorerUrl: "https://mempool.space/address/"
      };

      // Create and download the config file
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Bitcoin Multisig Wallet Config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export config');
    }
  };

  const generateAndSendFunds = async (toAddress: string, amount: number) => {
    try {
      setIsMining(true);
      setError(null);

      // Use the first wallet for mining
      const minerWallet = 'miner_wallet';

      // Check if miner wallet exists and is loaded
      const listWallets = await callRpc('listwallets', [], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password
      });

      let walletNeedsLoading = false;
      try {
        // Try to get wallet info to check if it's loaded and accessible
        await callRpc('getwalletinfo', [], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password,
          wallet: minerWallet
        });
      } catch (err) {
        walletNeedsLoading = true;
      }

      // Handle wallet creation/loading
      if (!listWallets.includes(minerWallet)) {
        // Create new miner wallet if it doesn't exist
        await callRpc('createwallet', [minerWallet], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });
      } else if (walletNeedsLoading) {
        // Load wallet if it exists but isn't loaded
        await callRpc('loadwallet', [minerWallet], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });
      }

      // Check current balance
      const balance = await callRpc('getbalance', [], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password,
        wallet: minerWallet
      });

      // Get miner address for mining rewards
      const minerAddress = await callRpc('getnewaddress', [], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password,
        wallet: minerWallet
      });

      // If balance is insufficient, mine blocks
      if (balance < amount) {
        // Mine 101 blocks to get mature coins
        await callRpc('generatetoaddress', [101, minerAddress], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });

        // Verify new balance after mining
        const newBalance = await callRpc('getbalance', [], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password,
          wallet: minerWallet
        });

        if (newBalance < amount) {
          throw new Error(`Insufficient balance (${newBalance} BTC) after mining. Need ${amount} BTC.`);
        }
      }

      // Send the specified amount to the multisig address
      const txid = await callRpc('sendtoaddress', [toAddress, amount], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password,
        wallet: minerWallet
      });

      // Generate 1 block to confirm the transaction
      await callRpc('generatetoaddress', [1, minerAddress], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password
      });

      // Verify the transaction was confirmed
      const tx = await callRpc('gettransaction', [txid], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password,
        wallet: minerWallet
      });

      if (!tx.confirmations || tx.confirmations < 1) {
        throw new Error('Transaction failed to confirm');
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate and send coins');
    } finally {
      setIsMining(false);
    }
  };

  const handleClearWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      setDepositAddress('');
      setCurrentStep(0);
      
      // Unload all wallets
      for (const wallet of wallets) {
        try {
          await callRpc('unloadwallet', [wallet.name], {
            url: rpc.host,
            port: rpc.port,
            username: rpc.username,
            password: rpc.password
          });
        } catch (err) {
          // Ignore errors if wallet doesn't exist
          console.log(`Error unloading wallet ${wallet.name}:`, err);
        }
      }

      // Reset wallet state
      setWallets([
        { name: 'reg_signer1', created: false },
        { name: 'reg_signer2', created: false }
      ]);

      // Reset multisig config
      setMultisigConfig({
        requiredSigners: 2,
        network: 'regtest',
        addressType: 'p2sh-p2wsh',
        signers: []
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear wallets');
    } finally {
      setLoading(false);
    }
  };

  const renderClearButton = () => (
    <button
      onClick={handleClearWallets}
      className="px-4 py-2 text-red-400 hover:text-red-300 disabled:opacity-50"
      disabled={loading}
    >
      Clear Wallets
    </button>
  );

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
      <div className="relative flex justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="relative flex-1 flex flex-col items-center">
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="absolute top-5 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-[2px]">
                <div
                  className={`h-full ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                />
              </div>
            )}
            
            {/* Circle */}
            <div className="relative z-10">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${
                    index === currentStep
                      ? 'bg-blue-500 border-2 border-blue-400 text-white'
                      : index < currentStep
                      ? 'bg-green-500 border-2 border-green-400 text-white'
                      : 'bg-slate-700 border-2 border-slate-600 text-slate-400'
                  }
                  transition-all duration-200
                `}
              >
                {index < currentStep ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
            </div>

            {/* Text */}
            <div className="mt-3 text-center">
              <div
                className={`text-sm font-medium ${
                  index === currentStep ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                {step.title}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {step.description}
              </div>
            </div>
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
                <div key={index} className="flex items-center gap-3 p-1 bg-slate-900 rounded-lg">
                  <input
                    type="text"
                    value={wallet.name}
                    onChange={(e) => handleWalletNameChange(index, e.target.value)}
                    disabled={wallet.created || wallet.loading}
                    className="flex-1 p-2 bg-slate-800 text-white border border-slate-700 rounded focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  />
                  <div className="flex items-center gap-2 pr-2">
                    {wallet.loading ? (
                      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : wallet.created && wallet.descriptor ? (
                      <span className="text-green-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : wallet.created ? (
                      <span className="text-yellow-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    ) : wallet.error ? (
                      <span className="text-red-500 hover:text-red-400 cursor-pointer" title={wallet.error}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    ) : (
                      wallets.length > 2 && (
                        <button
                          onClick={() => handleRemoveWallet(index)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                  {wallet.error && (
                    <div className="col-span-2 mt-1 text-sm text-red-400">
                      {wallet.error}
                    </div>
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

        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Wallet Descriptors</h3>
            </div>
            <div className="space-y-3">
              {wallets.map((wallet, index) => (
                <div key={index} className="p-3 bg-slate-900 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{wallet.name}</span>
                    {wallet.loading ? (
                      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : wallet.descriptor && wallet.fingerprint && wallet.xpub ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  {wallet.descriptor && wallet.fingerprint && wallet.xpub && (
                    <>
                      <div className="text-sm">
                        <span className="text-gray-400">Fingerprint: </span>
                        <span className="text-white font-mono">{wallet.fingerprint}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Path: </span>
                        <span className="text-white font-mono">{wallet.path}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">xPub: </span>
                        <span className="text-white font-mono break-all">{wallet.xpub}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Full Descriptor: </span>
                        <span className="text-white font-mono break-all">{wallet.descriptor}</span>
                      </div>
                    </>
                  )}
                  {wallet.error && (
                    <div className="text-sm text-red-400">
                      {wallet.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Configure Multisig</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <label className="block text-sm font-medium text-white mb-2">
                  Required Signers (M of {wallets.length})
                </label>
                <select
                  value={multisigConfig.requiredSigners}
                  onChange={(e) => setMultisigConfig(prev => ({ ...prev, requiredSigners: parseInt(e.target.value) }))}
                  className="w-full bg-slate-800 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: wallets.length }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} of {wallets.length} signatures required</option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-slate-900 rounded-lg space-y-3">
                <h4 className="text-white font-medium">Configured Signers</h4>
                {wallets.map((wallet, index) => (
                  <div key={index} className="pl-4 border-l-2 border-slate-700">
                    <div className="text-sm text-white font-medium">{wallet.name}</div>
                    <div className="text-xs text-gray-400 font-mono">
                      Fingerprint: {wallet.fingerprint}<br/>
                      Path: {wallet.bip32Path?.replace(/h/g, "'")}<br/>
                      xPub: {wallet.xpub}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={exportConfig}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Export Config
                </button>
                <button
                  onClick={() => {
                    const url = `https://unchained-capital.github.io/caravan/#/wallet/import?config=${encodeURIComponent(JSON.stringify({
                      name: "Multisig Wallet",
                      network: multisigConfig.network,
                      addressType: multisigConfig.addressType,
                      extendedPublicKeys: wallets
                        .filter(w => w.fingerprint && w.xpub && w.bip32Path)
                        .map(w => ({
                          name: w.name,
                          bip32Path: w.bip32Path!.replace(/h/g, "'"),
                          xpub: w.xpub!,
                          fingerprint: w.fingerprint!
                        })),
                      requiredSigners: multisigConfig.requiredSigners,
                      startingAddressIndex: 0
                    }))}`;
                    window.open(url, '_blank');
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Open in Caravan
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Fund Your Wallet</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <div className="text-sm text-gray-400 mb-4">
                  Your {multisigConfig.requiredSigners}-of-{wallets.length} multisig wallet is ready. Send funds to this address:
                </div>
                {depositAddress ? (
                  <>
                    <div className="p-3 bg-slate-800 rounded-lg mb-4">
                      <code className="text-white break-all font-mono text-sm">{depositAddress}</code>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          value={fundingAmount}
                          onChange={(e) => setFundingAmount(Math.max(0.00000001, Number(e.target.value)))}
                          min="0.00000001"
                          step="0.1"
                          className="flex-1 p-2 bg-slate-800 text-white border border-slate-700 rounded focus:border-blue-500 focus:outline-none"
                          placeholder="Amount in BTC"
                        />
                        <button
                          onClick={() => generateAndSendFunds(depositAddress, fundingAmount)}
                          disabled={isMining}
                          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                        >
                          {isMining ? (
                            <div className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Mining & Sending...
                            </div>
                          ) : (
                            'Fund your Wallet'
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        This will mine blocks to generate coins and send {fundingAmount} BTC to your multisig address (Regtest mode only)
                      </div>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        setError(null);

                        // Get the pubkeys from each wallet
                        const pubkeys = await Promise.all(wallets.map(async wallet => {
                          try {
                            const childPubkey = deriveChildPublicKey(
                              wallet.xpub!,
                              'm/0/1',
                              BitcoinNetwork.REGTEST
                            );
                            if (!childPubkey) {
                              throw new Error(`Failed to derive child public key for wallet ${wallet.name}`);
                            }
                            return Buffer.from(childPubkey, 'hex');
                          } catch (err) {
                            throw new Error(`Error deriving key for wallet ${wallet.name}: ${err}`);
                          }
                        }));

                        const pubkeyHexes = pubkeys.map(buf => buf.toString('hex'));
                        const result = generateMultisigFromPublicKeys(
                          BitcoinNetwork.REGTEST,
                          'P2WSH',
                          multisigConfig.requiredSigners,
                          ...pubkeyHexes
                        );

                        if (!result?.address) {
                          throw new Error('Failed to generate multisig address');
                        }

                        setDepositAddress(result.address);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to get deposit address');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Getting Address...' : 'Get Deposit Address'}
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-400">
                <p>What's next?</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Use "Fund with Coins" to fund your wallet in regtest mode</li>
                  <li>Or send real funds to the address above in mainnet/testnet</li>
                  <li>Use the exported config to spend from your wallet</li>
                  <li>Always test with small amounts first</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <div className="flex gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 text-white bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {renderClearButton()}
        </div>
        <button
          onClick={handleNext}
          disabled={
            loading || 
            (currentStep === 0 && wallets.filter(w => w.created && w.descriptor).length < 2) ||
            (currentStep === 1 && wallets.filter(w => w.created && w.descriptor && w.fingerprint && w.xpub).length < 2)
          }
          className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {currentStep === 0 ? 'Creating Wallets...' : 'Getting Descriptors...'}
            </div>
          ) : currentStep === steps.length - 1 ? (
            'Finish'
          ) : (
            'Next'
          )}
        </button>
      </div>

      {/* Status Message */}
      {!error && currentStep === 0 && (
        <div className="mt-4 text-sm text-gray-400">
          {wallets.filter(w => w.created && w.descriptor).length < 2 ? (
            `At least ${2 - wallets.filter(w => w.created && w.descriptor).length} more wallet${wallets.filter(w => w.created && w.descriptor).length === 1 ? '' : 's'} must be created to proceed`
          ) : (
            'Ready to proceed to next step'
          )}
        </div>
      )}

      {error && (
        <div className="p-3 mt-4 bg-red-500/10 border border-red-500/20 rounded text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};
