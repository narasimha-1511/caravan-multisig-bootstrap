export interface Transaction {
  txid: string;
  amount: number;
  type: 'incoming' | 'outgoing';
  status: 'pending' | 'confirmed';
  confirmations: number;
  timestamp: number;
  address: string;
}

export interface BitcoinAmount {
  btc: number;
  sats: number;
}

export const convertBtcToSats = (btc: number): number => {
  return Math.floor(btc * 100000000);
};

export const convertSatsToBtc = (sats: number): number => {
  return sats / 100000000;
};

export const formatBitcoinAmount = (amount: BitcoinAmount): string => {
  return `${amount.btc.toFixed(8)} BTC (${amount.sats.toLocaleString()} sats)`;
};

export const validateBitcoinAddress = (address: string): boolean => {
  // Basic validation - should be replaced with proper validation
  return address.length >= 26 && address.length <= 35;
};
