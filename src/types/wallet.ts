export interface WalletInfo {
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

export interface MultisigConfig {
  requiredSigners: number;
  network: 'regtest' | 'testnet' | 'mainnet';
  addressType: 'p2sh-p2wsh';
  signers: Array<{
    fingerprint: string;
    xpub: string;
    bip32Path: string;
  }>;
}

export interface Step {
  id: string;
  title: string;
  description: string;
}
