export async function callRpc(
  method: string,
  params: any[] = [],
  config: { url: string; port: string; username: string; password: string }
) {
  try {
    const response = await fetch(`http://${config.url}:${config.port}`, {
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
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
