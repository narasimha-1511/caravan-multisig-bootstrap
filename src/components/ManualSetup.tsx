import { useState, useRef } from 'react';
import { 
  Network, 
  generateMultisigFromPublicKeys, 
  validateExtendedPublicKey,
  deriveChildPublicKey,
  validateBIP32Path,
  BitcoinNetwork
} from '@caravan/bitcoin';
import { Buffer } from 'buffer';
import { WalletOperations } from './WalletOperations';
import { useWalletStore } from '../store/walletStore';

interface KeyPair {
  publicKey: string;
  bip32Path: string;
}

export const ManualSetup = () => {
  const { setConfig, setCurrentAddress, importConfig, addAddress } = useWalletStore();
  const [keys, setKeys] = useState<KeyPair[]>([]);
  const [threshold, setThreshold] = useState(2);
  const [totalSigners, setTotalSigners] = useState(3);
  const [multisigAddress, setMultisigAddress] = useState('');
  const [currentXpub, setCurrentXpub] = useState('');
  const [currentPath, setCurrentPath] = useState("m/0/0");
  const [error, setError] = useState('');
  const [pathErrors, setPathErrors] = useState<{[key: number]: string}>({});
  const [walletCreated, setWalletCreated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validatePath = (path: string): boolean => {
    try {
      // validateBIP32Path returns void if valid, throws if invalid
      if(validateBIP32Path(path) != "") {
        throw new Error('Invalid BIP32 path: ' + validateBIP32Path(path));
      }
      return true;
    } catch {
      return false;
    }
  };

  const addXpub = () => {
    if (!currentXpub.trim()) return;
    
    try {
      // Basic validation for xpub format
      if (!currentXpub.startsWith('xpub') && !currentXpub.startsWith('tpub') && !currentXpub.startsWith('ypub') && !currentXpub.startsWith('zpub')) {
        throw new Error('Invalid xpub format. Must start with "xpub", "tpub", "ypub", or "zpub"');
      }

      if (validateExtendedPublicKey(currentXpub, Network.REGTEST)) {
        throw new Error('Invalid xpub format. Must be a valid extended public key');
      }

      // Validate BIP32 path before adding
      if (!validatePath(currentPath)) {
        throw new Error(`Invalid BIP32 path: ${currentPath}. Must be in format like m/0/0`);
      }

      setKeys(prev => [...prev, { 
        publicKey: currentXpub.trim(),
        bip32Path: currentPath
      }]);
      setCurrentXpub('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid input');
    }
  };

  const deleteKey = (index: number) => {
    setKeys(prev => prev.filter((_, i) => i !== index));
    // Clear any path errors for this key
    setPathErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };

  const updatePath = (index: number, path: string) => {
    if (!validatePath(path)) {
      setPathErrors(prev => ({
        ...prev,
        [index]: `Invalid BIP32 path: ${path}. Must be in format like m/0/0`
      }));
      return;
    }
    setKeys(prev => prev.map((key, i) => 
      i === index ? { ...key, bip32Path: path } : key
    ));
    // Clear error for this key
    setPathErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };

  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      importConfig(text);
      const config = JSON.parse(text);
      
      // Set up the form with imported values
      setThreshold(config.quorum.requiredSigners);
      setTotalSigners(config.quorum.totalSigners);
      setKeys(config.extendedPublicKeys.map((key: any) => ({
        publicKey: key.xpub,
        bip32Path: key.bip32Path,
      })));
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError('Failed to import config: Invalid format');
    }
  };

  const handleExportConfig = () => {
    const config = {
      name: 'My Multisig Wallet',
      network: 'regtest',
      addressType: 'P2WSH',
      quorum: {
        requiredSigners: threshold,
        totalSigners: totalSigners,
      },
      extendedPublicKeys: keys.map(key => ({
        name: 'Extended Public Key',
        bip32Path: key.bip32Path,
        xpub: key.publicKey,
      })),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'multisig-wallet-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const createMultisig = async () => {
    try {
      setError('');
      console.log('Keys:', keys);

      // Check all paths are valid before proceeding
      const invalidPaths = keys.map((key, index) => ({
        index,
        valid: validatePath(key.bip32Path)
      })).filter(item => !item.valid);

      if (invalidPaths.length > 0) {
        throw new Error(`Invalid BIP32 paths for keys: ${invalidPaths.map(p => p.index + 1).join(', ')}`);
      }

      // Generate initial multisig address
      const pubkeys = await Promise.all(keys.map(async key => {
        try {
          if (validateExtendedPublicKey(key.publicKey, Network.REGTEST) != "") {
            throw new Error(`Invalid extended public key format: ${key.publicKey} ${validateExtendedPublicKey(key.publicKey, Network.REGTEST)}`);
          }

          const childPubkey = deriveChildPublicKey(
            key.publicKey,
            key.bip32Path.toString().replace(/'/g, ''),
            Network.REGTEST as BitcoinNetwork
          );

          if (!childPubkey) {
            throw new Error(`Failed to derive child public key from: ${key.publicKey}`);
          }

          return Buffer.from(childPubkey, 'hex');
        } catch (err) {
          throw new Error(`${err}`);
        }
      }));

      const pubkeyHexes = pubkeys.map(buf => buf.toString('hex'));
      const address = generateMultisigFromPublicKeys(
        Network.REGTEST,
        'P2WSH',
        threshold,
        ...pubkeyHexes
      );

      if (!address?.address) {
        throw new Error('Failed to generate multisig address');
      }

      // Save config to store
      setConfig({
        name: 'My Multisig Wallet',
        network: 'regtest',
        addressType: 'P2WSH',
        quorum: {
          requiredSigners: threshold,
          totalSigners: totalSigners,
        },
        extendedPublicKeys: keys,
      });

      // Set initial address
      setCurrentAddress(address.address);
      setMultisigAddress(address.address);

      // Generate 10 addresses by default
      for (let i = 0; i < 10; i++) {
        const path = `m/${i}`;
        const derivedPubkeys = await Promise.all(keys.map(async key => {
          const childPubkey = deriveChildPublicKey(
            key.publicKey,
            path.replace(/'/g, ''),
            Network.REGTEST as BitcoinNetwork
          );
          if (!childPubkey) {
            throw new Error(`Failed to derive child public key from: ${key.publicKey}`);
          }
          return Buffer.from(childPubkey, 'hex');
        }));

        const derivedPubkeyHexes = derivedPubkeys.map(buf => buf.toString('hex'));
        const newAddress = generateMultisigFromPublicKeys(
          Network.REGTEST,
          'P2WSH',
          threshold,
          ...derivedPubkeyHexes
        );

        if (newAddress?.address) {
          addAddress(newAddress.address, path);
        }
      }

      setWalletCreated(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error creating multisig');
      console.error('Error creating multisig:', error);
    }
  };

  const handleClearWallet = () => {
    setConfig({
      name: '',
      network: 'regtest',
      addressType: 'P2WSH',
      quorum: {
        requiredSigners: 0,
        totalSigners: 0,
      },
      extendedPublicKeys: [],
    });
    setCurrentAddress('');
    setMultisigAddress('');
    setWalletCreated(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {walletCreated ? 'Multisig Wallet' : 'Manual Multisig Setup'}
          </h2>
          <div className="flex gap-2">
            {walletCreated && (
              <button
                onClick={handleExportConfig}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
              >
                Export Config
              </button>
            )}
            {!walletCreated && (
              <>
              <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportConfig}
              accept=".json"
              className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                Import Config
              </button>
              </>
            )}
            {walletCreated && (
              <button
                onClick={handleClearWallet}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
              >
                Clear Wallet
              </button>
            )}

          </div>
        </div>
        
        {!walletCreated ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Required Signatures</label>
                <input
                  type="number"
                  min={1}
                  max={totalSigners}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-20 p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Total Signers</label>
                <input
                  type="number"
                  min={threshold}
                  max={15}
                  value={totalSigners}
                  onChange={(e) => setTotalSigners(Number(e.target.value))}
                  className="w-20 p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-400">Public Keys ({keys.length}/{totalSigners})</label>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={currentXpub}
                      onChange={(e) => setCurrentXpub(e.target.value)}
                      placeholder="Enter xpub"
                      className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="w-40">
                    <input
                      type="text"
                      value={currentPath}
                      onChange={(e) => setCurrentPath(e.target.value)}
                      placeholder="BIP32 Path"
                      className={`w-full p-2 bg-slate-900 text-white border rounded focus:outline-none font-mono ${
                        validatePath(currentPath) ? 'border-slate-600 focus:border-blue-500' : 'border-red-500'
                      }`}
                    />
                  </div>
                  <button
                    onClick={addXpub}
                    disabled={keys.length >= totalSigners || !currentXpub.trim() || !validatePath(currentPath)}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Key
                  </button>
                </div>
              </div>
              {error && (
                <div className="text-red-500 text-sm mb-4">
                  {error}
                </div>
              )}
              <div className="space-y-2 pt-2">
                {keys.map((key, index) => (
                  <div key={index} className="p-2 bg-slate-900 rounded text-sm font-mono break-all space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="overflow-hidden">{key.publicKey}</div>
                      <button
                        onClick={() => deleteKey(index)}
                        className="ml-2 px-2 py-1 text-red-500 hover:text-red-400 rounded"
                        title="Delete key"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-gray-400">BIP32 Path:</label>
                      <input
                        type="text"
                        value={key.bip32Path}
                        onChange={(e) => updatePath(index, e.target.value)}
                        className={`flex-1 p-1 bg-slate-800 text-white border rounded focus:outline-none font-mono text-sm ${
                          pathErrors[index] ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    {pathErrors[index] && (
                      <div className="text-red-500 text-xs">
                        {pathErrors[index]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {keys.length === totalSigners && (
              <button
                onClick={createMultisig}
                disabled={Object.keys(pathErrors).length > 0}
                className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Multisig Wallet
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* <div className="p-4 bg-slate-900 rounded mb-4">
              <div className="text-sm text-gray-400 mb-1">Multisig Address</div>
              <div className="font-mono break-all">{multisigAddress}</div>
            </div> */}
            <WalletOperations />
          </div>
        )}
      </div>
    </div>
  );
};
