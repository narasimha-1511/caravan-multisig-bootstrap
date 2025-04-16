import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Network, generateMultisigFromPublicKeys, deriveChildPublicKey, BitcoinNetwork } from '@caravan/bitcoin';
import { Transaction, validateBitcoinAddress, convertBtcToSats, convertSatsToBtc, formatBitcoinAmount } from '../utils/bitcoin';
import { useWalletStore } from '../store/walletStore';
import { Buffer } from 'buffer';

export const WalletOperations = () => {
  const { 
    currentAddress,
    addresses,
    transactions,
    addTransaction,
    addAddress,
    config 
  } = useWalletStore();
  
  const [activeTab, setActiveTab] = useState('send');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Send form state
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState({ btc: 0, sats: 0 });
  const [sendError, setSendError] = useState('');

  const tabs = [
    { id: 'send', label: 'Send', icon: '↗️' },
    { id: 'receive', label: 'Receive', icon: '↙️' },
    { id: 'pending', label: 'Pending', icon: '⏳' },
    { id: 'addresses', label: 'Addresses', icon: '📋' }
  ];

  const handleTabClick = (tabId: string) => {
    setLoading(true);
    setActiveTab(tabId);
    setTimeout(() => setLoading(false), 800);
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleAmountChange = (value: string, unit: 'btc' | 'sats') => {
    const numValue = parseFloat(value) || 0;
    if (unit === 'btc') {
      setAmount({
        btc: numValue,
        sats: convertBtcToSats(numValue)
      });
    } else {
      setAmount({
        btc: convertSatsToBtc(numValue),
        sats: numValue
      });
    }
  };

  const handleSend = async () => {
    setSendError('');
    if (!validateBitcoinAddress(recipientAddress)) {
      setSendError('Invalid Bitcoin address');
      return;
    }
    if (amount.btc <= 0) {
      setSendError('Amount must be greater than 0');
      return;
    }
    
    setLoading(true);
    try {
      // Create new transaction
      const newTx: Transaction = {
        txid: Math.random().toString(36).substring(2),
        amount: amount.btc,
        type: 'outgoing',
        status: 'pending',
        confirmations: 0,
        timestamp: Date.now(),
        address: recipientAddress
      };
      
      // Add to store
      addTransaction(newTx);
      
      // Reset form
      setRecipientAddress('');
      setAmount({ btc: 0, sats: 0 });
    } finally {
      setLoading(false);
    }
  };

  const generateNewAddress = async () => {
    if (!config) return;

    try {
      setLoading(true);
      const nextIndex = addresses.length;
      const newPath = `m/0/${nextIndex+1}`; // Calculate next path

      // Derive public keys for each signer at the new path
      const pubkeys = await Promise.all(config.extendedPublicKeys.map(async key => {
        const childPubkey = deriveChildPublicKey(
          key.publicKey,
          newPath.replace(/'/g, ''),
          Network.REGTEST as BitcoinNetwork
        );
        if (!childPubkey) {
          throw new Error(`Failed to derive child public key from: ${key.publicKey}`);
        }
        return Buffer.from(childPubkey, 'hex');
      }));

      // Generate multisig address from derived public keys
      const pubkeyHexes = pubkeys.map(buf => buf.toString('hex'));
      const newAddress = generateMultisigFromPublicKeys(
        Network.REGTEST,
        'P2WSH',
        config.quorum.requiredSigners,
        ...pubkeyHexes
      );

      if (!newAddress?.address) {
        throw new Error('Failed to generate new multisig address');
      }

      // Add the new address to the store
      addAddress(newAddress.address, newPath);
    } catch (err) {
      console.error('Error generating new address:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 mt-6">
      <div className="border-b border-slate-600">
        <div className="flex space-x-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`pb-4 px-4 relative ${
                activeTab === tab.id
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="min-h-[300px]">
            {activeTab === 'send' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Send Bitcoin</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Recipient Address</label>
                    <input
                      type="text"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="Enter Bitcoin address"
                      className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Amount (BTC)</label>
                      <input
                        type="number"
                        value={amount.btc || ''}
                        onChange={(e) => handleAmountChange(e.target.value, 'btc')}
                        step="0.00000001"
                        min="0"
                        placeholder="0.00000000"
                        className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Amount (sats)</label>
                      <input
                        type="number"
                        value={amount.sats || ''}
                        onChange={(e) => handleAmountChange(e.target.value, 'sats')}
                        step="1"
                        min="0"
                        placeholder="0"
                        className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  {sendError && (
                    <div className="text-red-500 text-sm">{sendError}</div>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={!recipientAddress || amount.btc <= 0}
                    className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Transaction
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'receive' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Receive Bitcoin</h3>
                <div className="flex flex-col items-center space-y-4 p-6 bg-slate-900 rounded">
                  <div className="bg-white p-4 rounded">
                    <QRCodeSVG value={currentAddress} size={200} />
                  </div>
                  <div className="w-full">
                    <div className="text-sm text-gray-400 mb-1">Your Multisig Address</div>
                    <div className="font-mono break-all bg-slate-800 p-3 rounded border border-slate-700">
                      {currentAddress}
                    </div>
                  </div>
                  <button 
                    onClick={handleCopyAddress}
                    className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                  >
                    {copied ? '✓ Copied!' : 'Copy Address'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Pending Transactions</h3>
                <div className="space-y-3">
                  {transactions.filter(tx => tx.status === 'pending').length === 0 ? (
                    <div className="text-gray-400 text-center py-8">
                      No pending transactions
                    </div>
                  ) : (
                    transactions
                      .filter(tx => tx.status === 'pending')
                      .map(tx => (
                        <div key={tx.txid} className="p-4 bg-slate-900 rounded border border-slate-700">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={tx.type === 'incoming' ? 'text-green-500' : 'text-red-500'}>
                                  {tx.type === 'incoming' ? '↙️' : '↗️'}
                                </span>
                                <span className="font-medium">
                                  {formatBitcoinAmount({ btc: tx.amount, sats: convertBtcToSats(tx.amount) })}
                                </span>
                              </div>
                              <div className="text-sm text-gray-400 mt-1 font-mono">{tx.txid}</div>
                            </div>
                            <div className="text-yellow-500 text-sm">Pending</div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'addresses' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Address List</h3>
                  <button
                    onClick={generateNewAddress}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    Generate New Address
                  </button>
                </div>
                <div className="space-y-3">
                  {addresses.map((addr, index) => (
                    <div key={index} className="p-4 bg-slate-900 rounded border border-slate-700">
                      <div className="space-y-2">
                        <div>
                          <div className="text-sm text-gray-400">Address {index + 1}</div>
                          <div className="font-mono text-sm break-all">{addr.address}</div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Path: <span className="font-mono">{addr.path}</span></span>
                          <span>{addr.balance} BTC</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
