import fs from 'node:fs';
import path from 'node:path';

function getApiKey() {
  if (process.env.ALCHEMY_API_KEY) {
    return process.env.ALCHEMY_API_KEY;
  }
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('ALCHEMY_API_KEY=')) {
        return trimmed.substring('ALCHEMY_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  throw new Error('ALCHEMY_API_KEY not found in process environment or .env file');
}

async function main() {
  const apiKey = getApiKey();
  const vitalikAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const url = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;

  console.log(`Calling Alchemy Ethereum endpoint for address: ${vitalikAddress} (vitalik.eth)...`);

  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getBalance',
    params: [vitalikAddress, 'latest']
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey === 'docs-demo') {
    headers['Origin'] = 'https://docs.alchemy.com';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
      console.error('Alchemy API Error:', data.error);
      process.exit(1);
    }

    const balanceWeiHex = data.result;
    const balanceWeiBigInt = BigInt(balanceWeiHex);

    // Convert Wei to ETH with 18 decimal precision
    const weiPerEth = BigInt(10 ** 18);
    const integerEth = balanceWeiBigInt / weiPerEth;
    const remainderWei = balanceWeiBigInt % weiPerEth;
    const remainderStr = remainderWei.toString().padStart(18, '0');
    const balanceEthFormatted = `${integerEth}.${remainderStr}`;

    console.log('\n--- Alchemy API Call Result ---');
    console.log(`Address:     ${vitalikAddress}`);
    console.log(`Balance Hex: ${balanceWeiHex}`);
    console.log(`Balance Wei: ${balanceWeiBigInt.toString()} wei`);
    console.log(`Balance ETH: ~${balanceEthFormatted} ETH`);
    console.log('-------------------------------\n');
  } catch (err) {
    console.error('Failed to make Alchemy API call:', err.message);
    process.exit(1);
  }
}

main();
