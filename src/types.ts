/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  gasToken: string;
  blockExplorer: string;
}

export interface ValidationItem {
  key: 'rpcUrl' | 'chainId' | 'gasToken' | 'blockExplorer' | 'deployment';
  label: string;
  foundValue: string | number | null;
  expectedValue: string | number | null;
  status: 'valid' | 'invalid' | 'warning' | 'missing';
  message: string;
  severity: 'success' | 'amber' | 'neutral' | 'red';
}

export interface ParsedConfig {
  rpcUrl: string | null;
  chainId: number | null;
  gasToken: string | null;
  blockExplorer: string | null;
  detectedType: 'hardhat' | 'foundry' | 'dotenv' | 'wagmi' | 'ethers' | 'raw' | 'unknown';
  rawLines: {
    rpcUrl?: string;
    chainId?: string;
    gasToken?: string;
    blockExplorer?: string;
  };
}

export interface RPCStatus {
  status: 'idle' | 'testing' | 'online' | 'offline';
  chainId: number | null;
  blockNumber: number | null;
  latencyMs: number | null;
  error?: string;
}
