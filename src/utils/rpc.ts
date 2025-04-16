export interface RpcConfig {
  url: string;
  port: string;
  username: string;
  password: string;
  wallet?: string;
}

export async function callRpc(
  method: string,
  params: any[] = [],
  config: RpcConfig
) {
  try {
    const walletPath = config.wallet && method !== 'createwallet' ? `/wallet/${config.wallet}` : '';
    const response = await fetch(`http://${config.url}:${config.port}${walletPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
      },
      body: JSON.stringify({
        jsonrpc: '1.0',
        id: 'multisig-wallet',
        method,
        params,
      }),
    });

    const data = await response.json();
    if (data.error) { 
      if (data.error.code === -19) {
        // wallet not found
        // let's create a watch only wallet
        console.log('Wallet not found, creating watch only wallet');
      }
      throw new Error(data.error.message);
    }

    return data.result;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`RPC call failed: ${error.message}`);
    }
    throw new Error('RPC call failed with unknown error');
  }
}
