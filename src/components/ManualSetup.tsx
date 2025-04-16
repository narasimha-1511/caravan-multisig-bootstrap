import { useState } from 'react';
import { 
  Network, 
  generateMultisigFromPublicKeys, 
  validateExtendedPublicKey,
  deriveChildPublicKey,
  validateBIP32Path,
  BitcoinNetwork
} from '@caravan/bitcoin';
import { Buffer } from 'buffer';

interface KeyPair {
  publicKey: string;
  bip32Path: string;
}

export const ManualSetup = () => {
  const [keys, setKeys] = useState<KeyPair[]>([]);
  const [threshold, setThreshold] = useState(2);
  const [totalSigners, setTotalSigners] = useState(3);
  const [multisigAddress, setMultisigAddress] = useState('');
  const [currentXpub, setCurrentXpub] = useState('');
  const [currentPath, setCurrentPath] = useState("m/0/0");
  const [error, setError] = useState('');
  const [pathErrors, setPathErrors] = useState<{[key: number]: string}>({});

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

      console.log('Valid paths:', keys);

      const pubkeys = await Promise.all(keys.map(async key => {
        try {

          console.log('Deriving public key for:', key);
          
          // First ensure we have a valid extended public key
          if (validateExtendedPublicKey(key.publicKey, Network.REGTEST) != "") {
            throw new Error(`Invalid extended public key format: ${key.publicKey} ${validateExtendedPublicKey(key.publicKey , Network.REGTEST)}`);
          }

          // Derive child public key using the BIP32 path
          const childPubkey = deriveChildPublicKey(
            key.publicKey,
            key.bip32Path.toString().replace(/'/g, ''), //remove all the ' characters
            Network.REGTEST as BitcoinNetwork
          );

          console.log('Derived child public key:---------', childPubkey);

          if (!childPubkey) {
            throw new Error(`Failed to derive child public key from: ${key.publicKey}`);
          }

          // Convert the hex string to Buffer
          return Buffer.from(childPubkey, 'hex');
        } catch (err) {
          throw new Error(`${err}`);
        }
      }));

      console.log("ended  ------")

      console.log('Derived public keys:', pubkeys);

      // Convert Buffers to hex strings for generateMultisigFromPublicKeys
      const pubkeyHexes = pubkeys.map(buf => buf.toString('hex'));
      console.log('Public key hexes:', pubkeyHexes);

      const address = generateMultisigFromPublicKeys(
        Network.TESTNET,
        'P2SH',
        threshold,
        ...pubkeyHexes // Pass hex strings instead of Buffers
      );

      console.log('Generated address:', address);

      if (!address?.address) {
        console.error('Address generation failed:', address);
        throw new Error('Failed to generate multisig address');
      }

      setMultisigAddress(address.address);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error creating multisig');
      console.error('Error creating multisig:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Manual Multisig Setup</h2>
        
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

          {multisigAddress && (
            <div className="p-4 bg-slate-900 rounded">
              <div className="text-sm text-gray-400 mb-1">Multisig Address</div>
              <div className="font-mono break-all">{multisigAddress}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
