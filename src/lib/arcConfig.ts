/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedConfig, ValidationItem, RPCStatus } from '../types';

export const OFFICIAL_ARC_TESTNET = {
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.network',
  chainId: 5042002,
  gasToken: 'USDC', // Technically Arc chain uses USDC for gas, though some configs might declare ARC. We'll clarify this!
  blockExplorer: 'https://testnet.arcscan.app',
};

/// Helper to recursively parse nested JSON nodes for our key parameters
function extractFromJson(obj: any): { rpcUrl?: string; chainId?: number; gasToken?: string; blockExplorer?: string } {
  let result: { rpcUrl?: string; chainId?: number; gasToken?: string; blockExplorer?: string } = {};
  if (typeof obj !== 'object' || obj === null) return result;

  const keys = Object.keys(obj);
  
  // Shallow scan
  for (const k of keys) {
    const lower = k.toLowerCase();
    
    // Chain ID
    if (lower === 'chainid' || lower === 'chain_id' || lower === 'id' || lower === 'networkid' || lower === 'network_id') {
      const val = obj[k];
      if (typeof val === 'number') {
        result.chainId = val;
      } else if (typeof val === 'string') {
        const num = val.startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10);
        if (!isNaN(num)) result.chainId = num;
      }
    }
    
    // RPC URL
    if (lower === 'rpc' || lower === 'rpcurl' || lower === 'rpc_url' || lower === 'url' || lower === 'endpoint' || lower === 'rpcendpoint' || lower === 'rpc_endpoints') {
      const val = obj[k];
      if (typeof val === 'string' && val.startsWith('http')) {
        result.rpcUrl = val;
      } else if (Array.isArray(val) && typeof val[0] === 'string' && val[0].startsWith('http')) {
        result.rpcUrl = val[0];
      } else if (typeof val === 'object' && val !== null) {
        const nested = extractFromJson(val);
        if (nested.rpcUrl) result.rpcUrl = nested.rpcUrl;
      }
    }
    
    // Gas Token
    if (lower === 'symbol' || lower === 'currency' || lower === 'gastoken' || lower === 'token' || lower === 'nativecurrency') {
      const val = obj[k];
      if (typeof val === 'string') {
        result.gasToken = val;
      } else if (typeof val === 'object' && val !== null) {
        if (typeof val.symbol === 'string') {
          result.gasToken = val.symbol;
        } else if (typeof val.name === 'string') {
          result.gasToken = val.name;
        }
      }
    }
    
    // Block Explorer
    if (lower === 'explorer' || lower === 'blockexplorer' || lower === 'explorerurl' || lower === 'blockexplorers' || lower === 'browser') {
      const val = obj[k];
      if (typeof val === 'string' && val.startsWith('http')) {
        result.blockExplorer = val;
      } else if (typeof val === 'object' && val !== null) {
        if (typeof val.url === 'string' && val.url.startsWith('http')) {
          result.blockExplorer = val.url;
        } else {
          const nested = extractFromJson(val);
          if (nested.blockExplorer) result.blockExplorer = nested.blockExplorer;
        }
      }
    }
  }

  // Recursive deep scanning
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === 'object' && val !== null) {
      const deep = extractFromJson(val);
      if (!result.rpcUrl && deep.rpcUrl) result.rpcUrl = deep.rpcUrl;
      if (result.chainId === undefined && deep.chainId !== undefined) result.chainId = deep.chainId;
      if (!result.gasToken && deep.gasToken) result.gasToken = deep.gasToken;
      if (!result.blockExplorer && deep.blockExplorer) result.blockExplorer = deep.blockExplorer;
    }
  }

  return result;
}

// Helper to determine what type of config file format is being pasted
export function detectConfigurationType(text: string): ParsedConfig['detectedType'] {
  const lowercase = text.toLowerCase().trim();
  
  if (lowercase.startsWith('{') || lowercase.startsWith('[')) {
    return 'raw'; // JSON format
  }
  if (lowercase.includes('module.exports') && (lowercase.includes('hardhat') || lowercase.includes('networks:'))) {
    return 'hardhat';
  }
  if (lowercase.includes('[rpc_endpoints]') || lowercase.includes('foundry.toml') || (lowercase.includes('libs') && lowercase.includes('[profile.'))) {
    return 'foundry';
  }
  if ((lowercase.includes('export const') || lowercase.includes('definechain') || lowercase.includes('createconfig')) && (lowercase.includes('chain') || lowercase.includes('wagmi') || lowercase.includes('viem'))) {
    return 'wagmi';
  }
  if (lowercase.includes('ethers.providers') || lowercase.includes('jsonrpcprovider') || lowercase.includes('new ethers')) {
    return 'ethers';
  }
  if (lowercase.includes('rpc_') || lowercase.includes('chain_id') || lowercase.includes('chainid=') || lowercase.includes('=.env')) {
    const lines = text.split('\n');
    const hasEnvPattern = lines.some(line => /^[A-Z0-9_]+\s*=\s*/.test(line.trim()));
    if (hasEnvPattern) return 'dotenv';
  }
  
  return 'raw';
}

// Highly resilient file content or snippet parser
export function parsePastedText(text: string): ParsedConfig {
  const detectedType = detectConfigurationType(text);
  const cleanInput = text.trim();
  
  let rpcUrl: string | null = null;
  let chainId: number | null = null;
  let gasToken: string | null = null;
  let blockExplorer: string | null = null;
  
  const rawLines: { rpcUrl?: string; chainId?: string; gasToken?: string; blockExplorer?: string; } = {};

  // 1. Single direct input checks
  if (cleanInput.startsWith('http') && !cleanInput.includes('\n') && !cleanInput.includes(' ') && !cleanInput.includes('=')) {
    if (cleanInput.includes('arcscan.app')) {
      blockExplorer = cleanInput;
      rawLines.blockExplorer = cleanInput;
    } else {
      rpcUrl = cleanInput;
      rawLines.rpcUrl = cleanInput;
    }
  } else if (!isNaN(Number(cleanInput)) && cleanInput.length >= 4) {
    chainId = parseInt(cleanInput, 10);
    rawLines.chainId = cleanInput;
  }

  // 2. JSON check fallback
  if (!rpcUrl || !chainId || !gasToken || !blockExplorer) {
    if (cleanInput.startsWith('{') || cleanInput.startsWith('[')) {
      try {
        const parsedJson = JSON.parse(cleanInput);
        const extracted = extractFromJson(parsedJson);
        if (extracted.rpcUrl) {
          rpcUrl = extracted.rpcUrl;
          rawLines.rpcUrl = `JSON: ${extracted.rpcUrl}`;
        }
        if (extracted.chainId !== undefined) {
          chainId = extracted.chainId;
          rawLines.chainId = `JSON: ${extracted.chainId}`;
        }
        if (extracted.gasToken) {
          gasToken = extracted.gasToken;
          rawLines.gasToken = `JSON: ${extracted.gasToken}`;
        }
        if (extracted.blockExplorer) {
          blockExplorer = extracted.blockExplorer;
          rawLines.blockExplorer = `JSON: ${extracted.blockExplorer}`;
        }
      } catch (err) {
        // Not clean JSON, proceed to regex
      }
    }
  }

  // 3. Resilient line-by-line pattern scan
  const lines = text.split('\n');
  
  // Standard regexes
  const chainIdRegexes = [
    /(?:chainId|chain_id|\bid\b|networkId|network_id)\s*[:=]\s*(?:['"]?([0-9]+|0x[0-9a-fA-F]+)['"]?)/i,
    /chainId\s*\??:\s*(5042002|1244|1243|[0-9]+)/i,
    /^[A-Z0-9_]*(?:CHAIN_ID|CHAINID|NETWORK_ID)\s*=\s*([0-9]+|0x[0-9a-fA-F]+)/, // dotenv style
    /\b(5042002)\b/ // Absolute fallback if the number 5042002 is isolated
  ];

  const rpcUrlRegexes = [
    /(?:url|rpc|rpcUrl|rpc_url|endpoint|http)\s*[:=]\s*['"](https?:\/\/[^\s'"]+)['"]/i,
    /^[A-Z0-9_]*(?:RPC_URL|RPC|ENDPOINT|URL)\s*=\s*['"]?(https?:\/\/[^\s'"]+)['"]?/, // dotenv
    /['"](https?:\/\/(?:rpc|testnet)[^\s'"]+)['"]/i, // general quoted urls with "rpc" or "testnet"
    /(https?:\/\/rpc-testnet\.arc\.network[^\s'"]*)/i,
    /(https?:\/\/rpc\.testnet\.arc\.network[^\s'"]*)/i
  ];

  const gasTokenRegexes = [
    /(?:symbol|currency|code|\btoken\b|nativeCurrencyName)\s*[:=]\s*['"]([a-zA-Z0-9]+)['"]/i,
    /symbol\s*:\s*['"](USDC|ARC|[a-zA-Z]{3,5})['"]/i,
    /^[A-Z0-9_]*(?:GAS_TOKEN|SYMBOL|CURRENCY|TOKEN)\s*=\s*['"]?([a-zA-Z0-9]+)['"]?/,
  ];

  const explorerRegexes = [
    /(?:explorer|blockExplorer|browser|explorerUrl)\s*[:=]\s*['"](https?:\/\/[^\s'"]+)['"]/i,
    /^[A-Z0-9_]*(?:EXPLORER|EXPLORER_URL|BROWSER)\s*=\s*['"]?(https?:\/\/[^\s'"]+)['"]?/,
    /['"](https?:\/\/(?:testnet\.arcscan|arcscan)[^\s'"]+)['"]/i,
    /(https?:\/\/testnet\.arcscan\.app[^\s'"]*)/i,
  ];

  // Process line by line first to capture exact rawLines
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Check RPC URL
    if (!rpcUrl) {
      for (const rx of rpcUrlRegexes) {
        const match = trimmed.match(rx);
        if (match && match[1]) {
          rpcUrl = match[1];
          rawLines.rpcUrl = trimmed;
          break;
        }
      }
    }

    // Check Chain ID
    if (!chainId) {
      for (const rx of chainIdRegexes) {
        const match = trimmed.match(rx);
        if (match && match[1]) {
          const val = match[1];
          chainId = val.startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10);
          rawLines.chainId = trimmed;
          break;
        }
      }
    }

    // Check Gas Token
    if (!gasToken) {
      for (const rx of gasTokenRegexes) {
        const match = trimmed.match(rx);
        if (match && match[1]) {
          gasToken = match[1];
          rawLines.gasToken = trimmed;
          break;
        }
      }
    }

    // Check Explorer
    if (!blockExplorer) {
      for (const rx of explorerRegexes) {
        const match = trimmed.match(rx);
        if (match && match[1]) {
          blockExplorer = match[1];
          rawLines.blockExplorer = trimmed;
          break;
        }
      }
    }
  }

  // Double fallback: if still not found, search the entire text via global regexes
  if (!rpcUrl) {
    const match = text.match(/https?:\/\/[a-zA-Z0-9.-]*arc\.network[^\s'"]*/i) || text.match(/https?:\/\/[a-zA-Z0-9.-]*arcscan[^\s'"]*/i);
    if (match) rpcUrl = match[0];
  }
  
  if (!chainId) {
    const match = text.match(/\b(5042002|1244|1243)\b/);
    if (match) chainId = parseInt(match[0], 10);
  }

  return {
    rpcUrl,
    chainId,
    gasToken,
    blockExplorer,
    detectedType,
    rawLines,
  };
}

// Generate human-friendly comparisons of found vs official parameters
export function validateConfig(parsed: ParsedConfig, text: string = ''): ValidationItem[] {
  const items: ValidationItem[] = [];

  // 1. RPC URL Validation
  {
    const val = parsed.rpcUrl;
    let status: ValidationItem['status'] = 'missing';
    let severity: ValidationItem['severity'] = 'neutral';
    let message = 'No RPC URL configuration was detected in the pasted content.';

    if (val) {
      const canonical = OFFICIAL_ARC_TESTNET.rpcUrl;
      const isOfficial = val.includes('rpc.testnet.arc.network');
      const isAltOfficial = val.includes('rpc-testnet.arc.network') || val.includes('testnet.arc.network');
      
      if (isOfficial || isAltOfficial) {
        status = 'valid';
        severity = 'success';
        message = `Correct RPC URL detected! Active endpoint matches official configurations.`;
      } else {
        status = 'invalid';
        severity = 'red';
        message = `Incorrect RPC URL. Expected "${canonical}", but found "${val}". Deploying contracts here will write to a different network.`;
      }
    }

    items.push({
      key: 'rpcUrl',
      label: 'RPC Node URL',
      foundValue: val,
      expectedValue: OFFICIAL_ARC_TESTNET.rpcUrl,
      status,
      message,
      severity,
    });
  }

  // 2. Chain ID Validation
  {
    const val = parsed.chainId;
    let status: ValidationItem['status'] = 'missing';
    let severity: ValidationItem['severity'] = 'neutral';
    let message = 'No Chain ID configuration was detected.';

    if (val !== null) {
      if (val === OFFICIAL_ARC_TESTNET.chainId) {
        status = 'valid';
        severity = 'success';
        message = `Chain ID is perfectly correct (${val}). Wallets and deployment engines will synchronize seamlessly.`;
      } else if (val === 1244 || val === 1243) {
        status = 'warning';
        severity = 'amber';
        message = `Found Chain ID ${val}, which belongs to a deprecated or alternative testnet fork. The active testnet chain ID is ${OFFICIAL_ARC_TESTNET.chainId}.`;
      } else {
        status = 'invalid';
        severity = 'red';
        message = `Critical mismatch! Found Chain ID ${val}, but Arc Testnet requires ${OFFICIAL_ARC_TESTNET.chainId}. Your deployment script will fail or deploy to the wrong ledger.`;
      }
    }

    items.push({
      key: 'chainId',
      label: 'Chain ID',
      foundValue: val,
      expectedValue: OFFICIAL_ARC_TESTNET.chainId,
      status,
      message,
      severity,
    });
  }

  // 3. Gas Token Validation
  {
    const val = parsed.gasToken;
    let status: ValidationItem['status'] = 'missing';
    let severity: ValidationItem['severity'] = 'neutral';
    let message = 'No currency/gas symbol was parsed.';

    if (val) {
      const vUpper = val.toUpperCase();
      if (vUpper === 'USDC') {
        status = 'valid';
        severity = 'success';
        message = 'Correct currency symbol (USDC). Gas is paid in USDC on the Arc network, which is fully supported!';
      } else if (vUpper === 'ARC') {
        status = 'warning';
        severity = 'amber';
        message = 'Native token is configured as "ARC". Note that transactions cost testnet USDC, but declaring ARC as symbol remains compatible with some client interfaces.';
      } else {
        status = 'invalid';
        severity = 'red';
        message = `Sub-optimal token symbol "${val}". Arc Testnet utilizes USDC as the primary transaction fee asset.`;
      }
    }

    items.push({
      key: 'gasToken',
      label: 'Native Fee Asset',
      foundValue: val,
      expectedValue: OFFICIAL_ARC_TESTNET.gasToken,
      status,
      message,
      severity,
    });
  }

  // 4. Block Explorer Validation
  {
    const val = parsed.blockExplorer;
    let status: ValidationItem['status'] = 'missing';
    let severity: ValidationItem['severity'] = 'neutral';
    let message = 'No block explorer configuration was parsed.';

    if (val) {
      const matchesArc = val.toLowerCase().includes('arcscan.app');
      if (matchesArc) {
        status = 'valid';
        severity = 'success';
        message = 'Active block explorer points to ArcScan (https://testnet.arcscan.app). Verifications will register correctly.';
      } else {
        status = 'invalid';
        severity = 'red';
        message = `Incorrect explorer link. Found "${val}", but official testnet transactions are indexable on "testnet.arcscan.app".`;
      }
    }

    items.push({
      key: 'blockExplorer',
      label: 'Block Explorer',
      foundValue: val,
      expectedValue: OFFICIAL_ARC_TESTNET.blockExplorer,
      status,
      message,
      severity,
    });
  }

  // 5. Deployment Readiness check
  {
    const hasDeploymentKeywords = /deploy|ignition|contracts?|factory|forge|hardhat|ethers|viem|wallet|pk|private_key/i.test(text);
    const rpcVal = parsed.rpcUrl;
    const chainVal = parsed.chainId;
    
    let status: ValidationItem['status'] = 'missing';
    let severity: ValidationItem['severity'] = 'neutral';
    let message = 'No deployment script or contract interaction keywords detected. Paste configuration scripts or deployment files to evaluate readiness.';
    let foundValue: string | null = null;

    if (hasDeploymentKeywords) {
      foundValue = 'Deployment Context Found';
      const isRpcValid = rpcVal && (rpcVal.includes('rpc.testnet.arc.network') || rpcVal.includes('rpc-testnet.arc.network') || rpcVal.includes('testnet.arc.network'));
      const isChainValid = chainVal === OFFICIAL_ARC_TESTNET.chainId;

      if (isRpcValid && isChainValid) {
        status = 'valid';
        severity = 'success';
        message = 'Deployment setup matches perfectly! Your scripts correctly point to Arc Testnet Chain ID (5042002) and RPC nodes. Ready to deploy successfully!';
      } else if (isRpcValid) {
        status = 'warning';
        severity = 'amber';
        message = 'RPC details are valid, but Chain ID parameter is either missing or mismatched. Ensure Chain ID 5042002 is active to execute contract deployments.';
      } else {
        status = 'invalid';
        severity = 'red';
        message = 'Missing network target parameters. To deploy successfully on Arc Testnet, configure your provider with the canonical RPC URL (https://rpc.testnet.arc.network) and Chain ID 5042002.';
      }
    }

    items.push({
      key: 'deployment',
      label: 'Deploy Readiness / Setup',
      foundValue,
      expectedValue: 'Optimal Settings',
      status,
      message,
      severity,
    });
  }

  return items;
}

// Live JSON-RPC endpoint diagnostics
export async function testRPC(url: string): Promise<RPCStatus> {
  const cleanUrl = url.trim();
  const startTime = Date.now();
  
  try {
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
        { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 }
      ]),
    });

    if (!response.ok) {
      throw new Error(`Endpoint returned HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    if (!Array.isArray(data) || data.length < 2) {
      throw new Error('RPC endpoint returned malformed response (expected multi-batch RPC output)');
    }

    const chainIdResult = data.find(item => item.id === 1);
    const blockNumberResult = data.find(item => item.id === 2);

    if (!chainIdResult || !chainIdResult.result) {
      throw new Error('Could not read Chain ID from RPC output');
    }

    if (!blockNumberResult || !blockNumberResult.result) {
      throw new Error('Could not read Block Number from RPC output');
    }

    const chainHex = chainIdResult.result;
    const blockHex = blockNumberResult.result;

    const chainId = parseInt(chainHex, 16);
    const blockNumber = parseInt(blockHex, 16);

    return {
      status: 'online',
      chainId,
      blockNumber,
      latencyMs,
    };
  } catch (err: any) {
    return {
      status: 'offline',
      chainId: null,
      blockNumber: null,
      latencyMs: null,
      error: err.message || 'Connection timeout or CORS pre-flight error. Check network routing.',
    };
  }
}
