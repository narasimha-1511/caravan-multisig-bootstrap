import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { callRpc } from '../utils/rpc';

export interface Transaction {
  txid: string;
  amount: number;
  type: 'incoming' | 'outgoing';
  status: 'pending' | 'confirmed';
  confirmations: number;
  timestamp: number;
  address: string;
}

interface KeyPair {
  publicKey: string;
  bip32Path: string;
}

interface WalletConfig {
  name: string;
  network: string;
  addressType: string;
  quorum: {
    requiredSigners: number;
    totalSigners: number;
  };
  extendedPublicKeys: KeyPair[];
}

interface RpcConfig {
  connected: boolean;
  error: string | null;
  host: string;
  port: string;
  username: string;
  password: string;
  watchOnlyWalletName: string;
  watchOnlyWalletNumber: number;
}

interface WalletState {
  // Wallet configuration
  config: WalletConfig | null;
  currentAddress: string;
  addresses: Array<{
    address: string;
    path: string;
    balance: number;
  }>;
  transactions: Transaction[];
  rpc: RpcConfig;

  // Actions
  setConfig: (config: WalletConfig) => void;
  setCurrentAddress: (address: string) => void;
  addAddress: (address: string, path: string) => void;
  addTransaction: (tx: Transaction) => void;
  updateAddressBalance: (address: string, balance: number) => void;
  fetchBalances: () => Promise<void>;

  // Import/Export
  importConfig: (jsonConfig: string) => void;
  exportConfig: () => string;

  // Reset
  resetWallet: () => void;

  setRpc: (updates: Partial<RpcConfig>) => void;
  testConnection: () => Promise<void>;
}

const initialState = {
  config: null,
  currentAddress: '',
  addresses: [],
  transactions: [],
  rpc: {
    connected: false,
    error: null,
    host: '',
    port: '',
    username: '',
    password: '',
    watchOnlyWalletName: 'watcher',
    watchOnlyWalletNumber: 1
  },
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setConfig: (config: WalletConfig) =>
        set({ config, currentAddress: '' }),

      setCurrentAddress: (address: string) =>
        set({ currentAddress: address }),

      addAddress: (address: string, path: string) =>
        set((state) => ({
          addresses: [...state.addresses, { address, path, balance: 0 }],
        })),

      addTransaction: (tx: Transaction) =>
        set((state) => ({
          transactions: [tx, ...state.transactions],
        })),

      updateAddressBalance: (address, balance) =>
        set((state) => ({
          addresses: state.addresses.map((addr) =>
            addr.address === address ? { ...addr, balance } : addr
          ),
        })),

      fetchBalances: async () => {
        const state = get();
        if (!state.rpc.connected) {
          console.error('RPC connection not established');
          throw new Error('RPC connection not established');
        }

        try {
          // Try to create a watch-only wallet first
          try {
            await callRpc('createwallet', [`watcher${state.rpc.watchOnlyWalletNumber}`, true, true], {
              url: state.rpc.host,
              port: state.rpc.port,
              username: state.rpc.username,
              password: state.rpc.password
            });
            console.log(`Created new watch-only wallet: watcher${state.rpc.watchOnlyWalletNumber}`);
          } catch (err: any) {
            // If wallet already exists, that's fine
            if (err.message.includes('Database already exists')) {
              console.log(`Using existing wallet: watcher${state.rpc.watchOnlyWalletNumber}`);
            } else {
              // For other errors, try the next wallet number
              state.rpc.watchOnlyWalletNumber++;
              set(state => ({ rpc: { ...state.rpc, watchOnlyWalletNumber: state.rpc.watchOnlyWalletNumber } }));
              await callRpc('createwallet', [`watcher${state.rpc.watchOnlyWalletNumber}`, true, true], {
                url: state.rpc.host,
                port: state.rpc.port,
                username: state.rpc.username,
                password: state.rpc.password
              });
              console.log(`Created new watch-only wallet with incremented number: watcher${state.rpc.watchOnlyWalletNumber}`);
            }
          }

          // Import addresses if needed
          // for (const addr of state.addresses) {
          //   try {
          //     await callRpc('importaddress', [addr.address, '', false], {
          //       url: state.rpc.host,
          //       port: state.rpc.port,
          //       username: state.rpc.username,
          //       password: state.rpc.password,
          //       wallet: `watcher${state.rpc.watchOnlyWalletNumber}`
          //     });
          //     console.log(`Imported address to watch-only wallet: ${addr.address}`);
          //   } catch (err) {
          //     // If address is already imported, that's fine
          //     console.log(`Address might already be imported: ${addr.address}`);
          //   }
          // }

          // Now fetch balances for each address
          for (const addr of state.addresses) {
            const response = await fetch(`http://${state.rpc.host}:${state.rpc.port}/wallet/watcher${state.rpc.watchOnlyWalletNumber}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${state.rpc.username}:${state.rpc.password}`),
              },
              body: JSON.stringify({
                jsonrpc: '1.0',
                id: 'cascade',
                method: 'getreceivedbyaddress',
                params: [addr.address],
              }),
            });

            const data = await response.json();
            if (data.error) {
              throw new Error(data.error.message);
            }

            if (data.result !== undefined) {
              state.updateAddressBalance(addr.address, data.result);
            }
          }
        } catch (error) {
          console.error('Error in fetchBalances:', error);
          throw error;
        }
      },

      importConfig: (jsonConfig: string) => {
        try {
          const config = JSON.parse(jsonConfig);
          // Basic validation
          if (!config.quorum || !config.extendedPublicKeys) {
            throw new Error('Invalid config format');
          }

          set({
            config: {
              name: config.name || 'Imported Wallet',
              network: config.network || 'regtest',
              addressType: config.addressType || 'P2WSH',
              quorum: {
                requiredSigners: config.quorum.requiredSigners,
                totalSigners: config.quorum.totalSigners,
              },
              extendedPublicKeys: config.extendedPublicKeys.map((key: any) => ({
                publicKey: key.xpub,
                bip32Path: key.bip32Path,
              })),
            },
          });
        } catch (err) {
          console.error('Failed to import config:', err);
          throw new Error('Invalid config format');
        }
      },

      exportConfig: () => {
        const { config } = get();
        if (!config) return '';

        const exportData = {
          name: config.name,
          network: config.network,
          addressType: config.addressType,
          quorum: config.quorum,
          extendedPublicKeys: config.extendedPublicKeys.map((key) => ({
            name: 'Extended Public Key',
            bip32Path: key.bip32Path,
            xpub: key.publicKey,
          })),
        };

        return JSON.stringify(exportData, null, 2);
      },

      resetWallet: () => set(initialState),

      setRpc: (updates) =>
        set((state) => ({
          rpc: { ...state.rpc, ...updates }
        })),

      testConnection: async () => {
        const state = get();
        set(state => ({ rpc: { ...state.rpc, error: null } }));

        try {
          const response = await fetch(`http://${state.rpc.host}:${state.rpc.port}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + btoa(`${state.rpc.username}:${state.rpc.password}`)
            },
            body: JSON.stringify({
              jsonrpc: '1.0',
              id: 'cascade',
              method: 'getblockcount',
              params: []
            })
          });

          const data = await response.json();
          if (data.error) {
            throw new Error(data.error.message);
          }

          // If we get here, connection was successful
          set(state => ({
            rpc: {
              ...state.rpc,
              connected: true,
              error: null
            }
          }));
        } catch (error) {
          set(state => ({
            rpc: {
              ...state.rpc,
              connected: false,
              error: error instanceof Error ? error.message : 'Failed to connect'
            }
          }));
          throw error;
        }
      },
    }),
    {
      name: 'wallet-storage',
    }
  )
);
