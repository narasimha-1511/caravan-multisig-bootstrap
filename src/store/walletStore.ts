import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

  // Actions
  setConfig: (config: WalletConfig) => void;
  setCurrentAddress: (address: string) => void;
  addAddress: (address: string, path: string) => void;
  addTransaction: (tx: Transaction) => void;
  
  // Import/Export
  importConfig: (jsonConfig: string) => void;
  exportConfig: () => string;
  
  // Reset
  resetWallet: () => void;
}

const initialState = {
  config: null,
  currentAddress: '',
  addresses: [],
  transactions: [],
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
    }),
    {
      name: 'wallet-storage',
    }
  )
);
