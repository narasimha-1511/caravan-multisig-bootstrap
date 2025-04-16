import { create } from 'zustand';
import { callRpc } from '../utils/rpc';

interface RpcConfig {
  url: string;
  port: string;
  username: string;
  password: string;
  connected: boolean;
  error?: string;
}

type WalletMode = 'manual' | 'bootstrap';

interface WalletState {
  mode: WalletMode;
  rpc: RpcConfig;
  balance: number;
  address: string;
  loading: boolean;
  setMode: (mode: WalletMode) => void;
  setRpc: (rpc: Partial<RpcConfig>) => void;
  setBalance: (balance: number) => void;
  setAddress: (address: string) => void;
  testConnection: () => Promise<boolean>;
  bootstrapWallet: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  mode: 'manual',
  rpc: {
    url: 'localhost',
    port: '18443',
    username: '',
    password: '',
    connected: false,
  },
  balance: 0,
  address: '',
  loading: false,
  
  setMode: (mode) => set({ mode }),
  setRpc: (rpc) => set((state) => ({ rpc: { ...state.rpc, ...rpc } })),
  setBalance: (balance) => set({ balance }),
  setAddress: (address) => set({ address }),

  testConnection: async () => {
    const { rpc } = get();
    set({ loading: true });
    try {
      // Test connection by calling getblockchaininfo
      await callRpc('getblockchaininfo', [], rpc);
      set({ rpc: { ...rpc, connected: true, error: undefined } });
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      set({ rpc: { ...rpc, connected: false, error: errorMessage } });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  bootstrapWallet: async () => {
    const { rpc } = get();
    set({ loading: true });
    try {
      // Generate some blocks if needed
      await callRpc('createwallet', ['multisig-wallet'], rpc);
      await callRpc('generatetoaddress', [101, await callRpc('getnewaddress', [], rpc)], rpc);
      
      // Create multisig address
      const pubkeys = await Promise.all([
        callRpc('getnewaddress', [], rpc),
        callRpc('getnewaddress', [], rpc),
      ]);
      
      const multisigResult = await callRpc('createmultisig', [2, pubkeys], rpc);
      set({ address: multisigResult.address });

      // Fund the multisig address
      await callRpc('generatetoaddress', [1, multisigResult.address], rpc);
      
      // Get balance
      const balance = await callRpc('getbalance', [], rpc);
      set({ balance });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      set({ rpc: { ...rpc, error: errorMessage } });
    } finally {
      set({ loading: false });
    }
  },
}));
