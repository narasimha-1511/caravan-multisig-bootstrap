import { useState } from 'react';
import { 
  generateMultisigFromPublicKeys, 
  Network as BitcoinNetwork,
  deriveChildPublicKey,
} from '@caravan/bitcoin';
import { Buffer } from 'buffer';
import { callRpc } from '../utils/rpc';
import { useWalletStore } from '../store/walletStore';
import { MultisigConfig, WalletInfo } from '../types/wallet';

export const useMultisigSetup = (wallets: WalletInfo[]) => {
  const { rpc } = useWalletStore();
  const [multisigConfig, setMultisigConfig] = useState<MultisigConfig>({
    requiredSigners: 2,
    network: 'regtest',
    addressType: 'p2sh-p2wsh',
    signers: []
  });
  const [depositAddress, setDepositAddress] = useState<string>('');
  const [isMining, setIsMining] = useState(false);
  const [fundingAmount, setFundingAmount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const exportConfig = async () => {
    try {
      setError(null);
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

      const xpubData = await Promise.all(walletDescriptors.map(async (desc) => {
        const match = desc.desc.match(/\[([a-f0-9]{8})(\/[0-9]+h\/[0-9]+h\/[0-9]+h)\]([a-zA-Z0-9]+)/);
        if (!match) {
          throw new Error('Failed to extract xpub data from descriptor');
        }

        const rawDesc = await callRpc('getdescriptorinfo', [desc.desc], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });

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
        network: "regtest",
        client: {
          type: "private",
          url: `http://${rpc.host}:${rpc.port}`,
          username: rpc.username,
          walletName: "watcher"+rpc.watchOnlyWalletNumber
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

      const minerWallet = 'miner_wallet';
      const listWallets = await callRpc('listwallets', [], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password
      });

      let walletNeedsLoading = false;
      try {
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

      if (!listWallets.includes(minerWallet)) {
        await callRpc('createwallet', [minerWallet], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });
      } else if (walletNeedsLoading) {
        await callRpc('loadwallet', [minerWallet], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });
      }

      const balance = await callRpc('getbalance', [], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password,
        wallet: minerWallet
      });

      const minerAddress = await callRpc('getnewaddress', [], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password,
        wallet: minerWallet
      });

      if (balance < amount) {
        await callRpc('generatetoaddress', [101, minerAddress], {
          url: rpc.host,
          port: rpc.port,
          username: rpc.username,
          password: rpc.password
        });

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

      const txid = await callRpc('sendtoaddress', [toAddress, amount], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password,
        wallet: minerWallet
      });

      await callRpc('generatetoaddress', [1, minerAddress], {
        url: rpc.host,
        port: rpc.port,
        username: rpc.username,
        password: rpc.password
      });

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

  const generateDepositAddress = async () => {
    try {
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
      return result.address;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get deposit address');
      return null;
    }
  };

  return {
    multisigConfig,
    setMultisigConfig,
    depositAddress,
    setDepositAddress,
    isMining,
    fundingAmount,
    setFundingAmount,
    error,
    setError,
    exportConfig,
    generateAndSendFunds,
    generateDepositAddress
  };
};
