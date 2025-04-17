import { useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { callRpc } from '../utils/rpc';
import { WalletInfo } from '../types/wallet';

export const useWalletSetup = () => {
  const { rpc } = useWalletStore();
  const [wallets, setWallets] = useState<WalletInfo[]>([
    { name: 'reg_signer1', created: false },
    { name: 'reg_signer2', created: false }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decodeDescriptor = (
    desc: string
  ): { bip32Path: string; fingerprint: string; xpub: string } => {
    const match = desc.match(/\[([0-9a-fA-F]{8})(\/[0-9]+h\/[0-9]+h\/[0-9]+h)\]([a-zA-Z0-9]+)/);
    if (!match) {
      throw new Error("Invalid descriptor format");
    }
    return {
      fingerprint: match[1],
      bip32Path: match[2],
      xpub: match[3],
    };
  };

  const createWallets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      for (const wallet of wallets) {
        try {
          await callRpc('loadwallet', [wallet.name], {
            url: rpc.host,
            port: rpc.port,
            username: rpc.username,
            password: rpc.password
          });
        } catch (err) {
          console.error(`Failed to load wallet ${wallet.name}:`, err);
        }
      }

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
            let walletNeedsLoading = false;
            try {
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
              await callRpc('loadwallet', [wallet.name], {
                url: rpc.host,
                port: rpc.port,
                username: rpc.username,
                password: rpc.password
              });
            }

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
            }
          } else {
            await callRpc('createwallet', [wallet.name], {
              url: rpc.host,
              port: rpc.port,
              username: rpc.username,
              password: rpc.password
            });

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
            }
          }
        } catch (err: any) {
          setWallets(prev => prev.map(w => 
            w.name === wallet.name ? { ...w, loading: false, error: err.message } : w
          ));
        }
      }
      
      const validWallets = wallets.filter(w => w.created && w.descriptor);
      if (validWallets.length >= 2) {
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup wallets');
      return false;
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

  const handleClearWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      for (const wallet of wallets) {
        try {
          await callRpc('unloadwallet', [wallet.name], {
            url: rpc.host,
            port: rpc.port,
            username: rpc.username,
            password: rpc.password
          });
        } catch (err) {
          console.log(`Error unloading wallet ${wallet.name}:`, err);
        }
      }

      setWallets([
        { name: 'reg_signer1', created: false },
        { name: 'reg_signer2', created: false }
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear wallets');
    } finally {
      setLoading(false);
    }
  };

  return {
    wallets,
    loading,
    error,
    createWallets,
    handleAddWallet,
    handleRemoveWallet,
    handleWalletNameChange,
    handleClearWallets,
    setError
  };
};
