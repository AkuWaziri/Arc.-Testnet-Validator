/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { OFFICIAL_ARC_TESTNET, testRPC } from '../lib/arcConfig';
import { Check, AlertTriangle, X, Info, Sparkles, Copy, Sliders, RefreshCw, Zap, Wrench, Layers, Globe, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RPCStatus, ValidationItem } from '../types';

type PresetType = 'ethereum' | 'sepolia' | 'wrong_arc' | 'custom_blank';

interface MatchPreset {
  name: string;
  rpcUrl: string;
  chainId: string;
  gasToken: string;
  blockExplorer: string;
  description: string;
}

const PRESETS: Record<PresetType, MatchPreset> = {
  ethereum: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    chainId: '1',
    gasToken: 'ETH',
    blockExplorer: 'https://etherscan.io',
    description: 'Standard default Ethereum mainnet parameters. Fully misaligned with Arc.'
  },
  sepolia: {
    name: 'Arbitrum Sepolia Devnet',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    chainId: '421614',
    gasToken: 'ETH',
    blockExplorer: 'https://sepolia.arbiscan.io',
    description: 'Common rollups testnet configuration. Partially correct EVM but incorrect chain ID.'
  },
  wrong_arc: {
    name: 'Deprecated Arc Fork',
    rpcUrl: 'https://rpc-testnet.arc.network',
    chainId: '1243',
    gasToken: 'ARC',
    blockExplorer: 'https://etherscan.io',
    description: 'Old testing parameters with deprecated branch Chain ID 1243.'
  },
  custom_blank: {
    name: 'Clear Canvas',
    rpcUrl: '',
    chainId: '',
    gasToken: '',
    blockExplorer: '',
    description: 'Start with blank inputs and type parameters manually.'
  }
};

export default function InteractiveMatcher() {
  const [rpcUrl, setRpcUrl] = useState('https://rpc-testnet.arc.network');
  const [chainId, setChainId] = useState('1243');
  const [gasToken, setGasToken] = useState('ARC');
  const [blockExplorer, setBlockExplorer] = useState('https://etherscan.io');
  
  const [framework, setFramework] = useState<'hardhat' | 'foundry' | 'wagmi' | 'ethers'>('hardhat');
  const [copied, setCopied] = useState(false);
  
  // Live RPC Test State
  const [rpcTestingState, setRpcTestingState] = useState<RPCStatus | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);
  const [showAutoFixBanner, setShowAutoFixBanner] = useState(false);

  // Compute validations dynamically
  const getValidationReport = (): { score: number; items: ValidationItem[]; total: number } => {
    const items: ValidationItem[] = [];
    let correctCount = 0;

    // 1. RPC URL Match
    const cleanRpc = rpcUrl.trim();
    if (!cleanRpc) {
      items.push({
        key: 'rpcUrl',
        label: 'RPC Node URL',
        foundValue: '',
        expectedValue: OFFICIAL_ARC_TESTNET.rpcUrl,
        status: 'missing',
        message: 'A waiting RPC URL input. Enter your testnet node endpoint IP or domain.',
        severity: 'neutral'
      });
    } else {
      const isOfficial = cleanRpc.includes('rpc.testnet.arc.network');
      const isAltOfficial = cleanRpc.includes('rpc-testnet.arc.network') || cleanRpc.includes('testnet.arc.network');
      
      if (isOfficial) {
        correctCount += 1;
        items.push({
          key: 'rpcUrl',
          label: 'RPC Node URL',
          foundValue: cleanRpc,
          expectedValue: OFFICIAL_ARC_TESTNET.rpcUrl,
          status: 'valid',
          message: 'RPC Node perfectly matches official Arc Testnet specifications!',
          severity: 'success'
        });
      } else if (isAltOfficial) {
        correctCount += 0.5; // Partial
        items.push({
          key: 'rpcUrl',
          label: 'RPC Node URL',
          foundValue: cleanRpc,
          expectedValue: OFFICIAL_ARC_TESTNET.rpcUrl,
          status: 'warning',
          message: 'Alternate spelling detected. Keep "https://rpc.testnet.arc.network" as your production primary target.',
          severity: 'amber'
        });
      } else {
        items.push({
          key: 'rpcUrl',
          label: 'RPC Node URL',
          foundValue: cleanRpc,
          expectedValue: OFFICIAL_ARC_TESTNET.rpcUrl,
          status: 'invalid',
          message: `Incorrect network RPC. Standard for Arc is "${OFFICIAL_ARC_TESTNET.rpcUrl}".`,
          severity: 'red'
        });
      }
    }

    // 2. Chain ID Match
    const numChain = parseInt(chainId.trim(), 10);
    if (!chainId.trim()) {
      items.push({
        key: 'chainId',
        label: 'Chain ID',
        foundValue: null,
        expectedValue: OFFICIAL_ARC_TESTNET.chainId,
        status: 'missing',
        message: 'Chain ID field is empty.',
        severity: 'neutral'
      });
    } else if (isNaN(numChain)) {
      items.push({
        key: 'chainId',
        label: 'Chain ID',
        foundValue: chainId,
        expectedValue: OFFICIAL_ARC_TESTNET.chainId,
        status: 'invalid',
        message: 'Provided Chain ID must be a standard base-10 integer representation.',
        severity: 'red'
      });
    } else if (numChain === OFFICIAL_ARC_TESTNET.chainId) {
      correctCount += 1;
      items.push({
        key: 'chainId',
        label: 'Chain ID',
        foundValue: numChain,
        expectedValue: OFFICIAL_ARC_TESTNET.chainId,
        status: 'valid',
        message: 'Chain ID matches Arc Testnet exactly (5042002). Transactions will deploy beautifully.',
        severity: 'success'
      });
    } else if (numChain === 1243 || numChain === 1244) {
      correctCount += 0.5;
      items.push({
        key: 'chainId',
        label: 'Chain ID',
        foundValue: numChain,
        expectedValue: OFFICIAL_ARC_TESTNET.chainId,
        status: 'warning',
        message: 'Deprecated or internal test forked Chain ID. Use official 5042002.',
        severity: 'amber'
      });
    } else {
      items.push({
        key: 'chainId',
        label: 'Chain ID',
        foundValue: numChain,
        expectedValue: OFFICIAL_ARC_TESTNET.chainId,
        status: 'invalid',
        message: `Mismatch: Expected ${OFFICIAL_ARC_TESTNET.chainId}, but your configuration has ${numChain}.`,
        severity: 'red'
      });
    }

    // 3. Gas Token Match
    const cleanToken = gasToken.trim().toUpperCase();
    if (!cleanToken) {
      items.push({
        key: 'gasToken',
        label: 'Gas Token Symbol',
        foundValue: '',
        expectedValue: OFFICIAL_ARC_TESTNET.gasToken,
        status: 'missing',
        message: 'Input which currency asset is used for transaction gas fees.',
        severity: 'neutral'
      });
    } else if (cleanToken === 'USDC') {
      correctCount += 1;
      items.push({
        key: 'gasToken',
        label: 'Gas Token Symbol',
        foundValue: cleanToken,
        expectedValue: 'USDC',
        status: 'valid',
        message: 'Transaction fees on Arc network are paid in USDC. Perfect!',
        severity: 'success'
      });
    } else if (cleanToken === 'ARC') {
      correctCount += 0.8; // High rating, standard symbol remains functional
      items.push({
        key: 'gasToken',
        label: 'Gas Token Symbol',
        foundValue: cleanToken,
        expectedValue: 'USDC',
        status: 'warning',
        message: 'ARC token works symbolically in wallet list headers, but the gas cost is technically backed by USDC.',
        severity: 'amber'
      });
    } else {
      items.push({
        key: 'gasToken',
        label: 'Gas Token Symbol',
        foundValue: cleanToken,
        expectedValue: 'USDC',
        status: 'invalid',
        message: `Non-ideal fee asset "${cleanToken}". Arc Testnet utilizes USDC or ARC specifically.`,
        severity: 'red'
      });
    }

    // 4. Block Explorer Match
    const cleanExplorer = blockExplorer.trim().toLowerCase();
    if (!cleanExplorer) {
      items.push({
        key: 'blockExplorer',
        label: 'Block Explorer',
        foundValue: '',
        expectedValue: OFFICIAL_ARC_TESTNET.blockExplorer,
        status: 'missing',
        message: 'Add an explorer URL to lookup transactions interactively.',
        severity: 'neutral'
      });
    } else {
      const matchesArc = cleanExplorer.includes('arcscan.app');
      if (matchesArc) {
        correctCount += 1;
        items.push({
          key: 'blockExplorer',
          label: 'Block Explorer',
          foundValue: blockExplorer.trim(),
          expectedValue: OFFICIAL_ARC_TESTNET.blockExplorer,
          status: 'valid',
          message: 'Successfully points to ArcScan ledger explorer (testnet.arcscan.app).',
          severity: 'success'
        });
      } else {
        items.push({
          key: 'blockExplorer',
          label: 'Block Explorer',
          foundValue: blockExplorer.trim(),
          expectedValue: OFFICIAL_ARC_TESTNET.blockExplorer,
          status: 'invalid',
          message: `Explorer doesn't point to ArcScan. Contracts cannot be verified here.`,
          severity: 'red'
        });
      }
    }

    const alignmentPercentage = Math.round((correctCount / 4) * 100);

    return {
      score: alignmentPercentage,
      items,
      total: 4
    };
  };

  const { score, items: validationList } = getValidationReport();

  // Highlight fix badge when score is not 100%
  useEffect(() => {
    if (score < 100) {
      setShowAutoFixBanner(true);
    } else {
      setShowAutoFixBanner(false);
    }
  }, [score]);

  // Load preset parameters
  const loadPreset = (presetKey: PresetType) => {
    const data = PRESETS[presetKey];
    setRpcUrl(data.rpcUrl);
    setChainId(data.chainId);
    setGasToken(data.gasToken);
    setBlockExplorer(data.blockExplorer);
    setRpcTestingState(null);
  };

  // One click Auto-Fix to official specs
  const triggerAutoFix = () => {
    setRpcUrl(OFFICIAL_ARC_TESTNET.rpcUrl);
    setChainId(String(OFFICIAL_ARC_TESTNET.chainId));
    setGasToken(OFFICIAL_ARC_TESTNET.gasToken);
    setBlockExplorer(OFFICIAL_ARC_TESTNET.blockExplorer);
    setRpcTestingState(null);
  };

  // Perform a live JSON-RPC test request
  const testConnectionLive = async () => {
    if (!rpcUrl.trim()) return;
    setRpcLoading(true);
    setRpcTestingState(null);
    try {
      const res = await testRPC(rpcUrl);
      setRpcTestingState(res);
    } catch {
      setRpcTestingState({
        status: 'offline',
        chainId: null,
        blockNumber: null,
        latencyMs: null,
        error: 'Failed to query host. Connection rejected or check CORS headers.'
      });
    } finally {
      setRpcLoading(false);
    }
  };

  // Dynamic code builder
  const getCodeSnippet = () => {
    const uRpc = rpcUrl.trim() || 'YOUR_RPC_ENDPOINT';
    const uChain = chainId.trim() || 'YOUR_CHAIN_ID';
    const uExplorer = blockExplorer.trim() || 'YOUR_EXPLORER';
    const uToken = gasToken.trim().toUpperCase() || 'USDC';

    switch (framework) {
      case 'foundry':
        return `# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

[rpc_endpoints]
arc_testnet = "${uRpc}"
# Command to run:
# forge create --rpc-url arc_testnet --private-key $PRIVATE_KEY src/MyContract.sol:MyContract`;
      case 'wagmi':
        return `// wagmi.config.ts / viem chain helper
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: ${isNaN(parseInt(uChain, 10)) ? '5042002' : uChain},
  name: 'Arc Testnet',
  nativeCurrency: { 
    name: 'USD Coin', 
    symbol: '${uToken}', 
    decimals: 18 
  },
  rpcUrls: {
    default: { http: ['${uRpc}'] },
    public: { http: ['${uRpc}'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: '${uExplorer}' },
  },
});`;
      case 'ethers':
        return `// Setup using ethers v6
import { ethers } from "ethers";

// Connect to Arc. Testnet Node Client
const provider = new ethers.JsonRpcProvider(
  "${uRpc}",
  {
    chainId: ${isNaN(parseInt(uChain, 10)) ? '5042002' : uChain},
    name: "Arc Testnet"
  }
);`;
      case 'hardhat':
      default:
        return `// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: "${uRpc}",
      chainId: ${isNaN(parseInt(uChain, 10)) ? '5042002' : uChain},
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};

export default config;`;
    }
  };

  const copyConfigSnippet = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Introduction Header Block of Bento */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Sliders className="h-5 w-5 text-indigo-500" />
          Interactive Alignment Matchmaker
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-sans">
          Don't have configuration text to paste? Type your deployment network parameters manually or load a sandbox template to calculate compatibility with the Arc. network testnet instantly.
        </p>
      </div>

      {/* Preset loaders */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest font-mono block">Load Active Test parameters</span>
          <p className="text-[11px] text-slate-450 font-sans tracking-tight">Populate sandbox inputs with mock presets to check the match auditor live:</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadPreset('ethereum')}
            className="text-[10px] font-mono font-bold px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
            title={PRESETS.ethereum.description}
          >
            🔴 Ethereum Preset
          </button>
          <button
            onClick={() => loadPreset('sepolia')}
            className="text-[10px] font-mono font-bold px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
            title={PRESETS.sepolia.description}
          >
            🟡 Sepolia Preset
          </button>
          <button
            onClick={() => loadPreset('wrong_arc')}
            className="text-[10px] font-mono font-bold px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
            title={PRESETS.wrong_arc.description}
          >
            🟠 Old Arc Fork
          </button>
          <button
            onClick={() => loadPreset('custom_blank')}
            className="text-[10px] font-mono font-bold px-2.5 py-1 bg-white hover:bg-indigo-50 border border-dashed border-indigo-200 text-indigo-600 rounded transition-colors cursor-pointer"
            title={PRESETS.custom_blank.description}
          >
            🧹 Clear Inputs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Interactive Input Parameters */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <span className="text-xs font-bold text-slate-500 block uppercase font-mono tracking-wider">Configure Parameters</span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* RPC URL */}
              <div className="space-y-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="manual-rpc" className="text-[10px] font-black font-sans uppercase tracking-wider text-slate-500">
                    RPC Endpoint URL
                  </label>
                  <button
                    onClick={testConnectionLive}
                    disabled={rpcLoading || !rpcUrl.trim()}
                    className="text-[9px] font-mono font-extrabold text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {rpcLoading ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
                    Test RPC Connection
                  </button>
                </div>
                <input
                  id="manual-rpc"
                  type="text"
                  placeholder="https://rpc.testnet.arc.network"
                  value={rpcUrl}
                  onChange={(e) => setRpcUrl(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50/10 focus:outline-hidden focus:border-indigo-400 focus:bg-white transition-all text-slate-705"
                />
              </div>

              {/* Chain ID */}
              <div className="space-y-1">
                <label htmlFor="manual-chain" className="text-[10px] font-black font-sans uppercase tracking-wider text-slate-500">
                  Network Chain ID
                </label>
                <input
                  id="manual-chain"
                  type="text"
                  placeholder="5042002"
                  value={chainId}
                  onChange={(e) => setChainId(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50/10 focus:outline-hidden focus:border-indigo-400 focus:bg-white transition-all text-slate-705"
                />
              </div>

              {/* Gas token symbol */}
              <div className="space-y-1">
                <label htmlFor="manual-token" className="text-[10px] font-black font-sans uppercase tracking-wider text-slate-500">
                  Gas Token Asset Symbol
                </label>
                <input
                  id="manual-token"
                  type="text"
                  placeholder="USDC"
                  value={gasToken}
                  onChange={(e) => setGasToken(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50/10 focus:outline-hidden focus:border-indigo-400 focus:bg-white transition-all text-slate-705"
                />
              </div>

              {/* Block Explorer */}
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="manual-explorer" className="text-[10px] font-black font-sans uppercase tracking-wider text-slate-500">
                  Block Explorer link URL
                </label>
                <input
                  id="manual-explorer"
                  type="text"
                  placeholder="https://testnet.arcscan.app"
                  value={blockExplorer}
                  onChange={(e) => setBlockExplorer(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border-2 border-slate-200 rounded-xl bg-slate-50/10 focus:outline-hidden focus:border-indigo-400 focus:bg-white transition-all text-slate-705"
                />
              </div>

            </div>

            {/* RPC Test Diagnostics results inline */}
            <AnimatePresence>
              {rpcTestingState && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-slate-200 p-3 text-xs font-mono bg-slate-50/80 space-y-1.5 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-slate-450 font-bold flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-indigo-500 animate-pulse" /> Live RPC Diagnosis
                    </span>
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                      rpcTestingState.status === 'online' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {rpcTestingState.status}
                    </span>
                  </div>
                  {rpcTestingState.status === 'online' ? (
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1">
                      <div className="bg-white border rounded p-1.5">
                        <span className="text-[8px] text-slate-400 block font-sans">Active Gen Chain ID</span>
                        <span className="text-slate-800 font-extrabold">{rpcTestingState.chainId}</span>
                      </div>
                      <div className="bg-white border rounded p-1.5">
                        <span className="text-[8px] text-slate-400 block font-sans">Block Height</span>
                        <span className="text-slate-800 font-extrabold">#{rpcTestingState.blockNumber}</span>
                      </div>
                      <div className="bg-white border rounded p-1.5">
                        <span className="text-[8px] text-slate-400 block font-sans">Latency</span>
                        <span className="text-emerald-600 font-extrabold">{rpcTestingState.latencyMs}ms</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-rose-500 leading-normal font-sans">
                      ⚠️ Connection Error: {rpcTestingState.error}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Micro Auto Fix Trigger overlay in left panel */}
            {showAutoFixBanner && (
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-600 text-white rounded-lg animate-pulse">
                    <Wrench className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-800 block">Mismatches detected</span>
                    <p className="text-[10px] text-indigo-650 leading-tight font-sans">One-Click optimizer completes target validation parameters instantly.</p>
                  </div>
                </div>
                <button
                  onClick={triggerAutoFix}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-mono font-black py-1.5 px-3 rounded-lg shadow-sm cursor-pointer whitespace-nowrap transition-colors"
                >
                  ⚡ AUTO-ALIGN NOW
                </button>
              </div>
            )}
          </div>
          
          {/* Output Code Template Section on Left side */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-sm relative flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 font-mono">Bespoke Config Architect</span>
              </div>
              <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5 font-mono">
                {(['hardhat', 'foundry', 'wagmi', 'ethers'] as const).map(lib => (
                  <button
                    key={lib}
                    onClick={() => setFramework(lib)}
                    className={`text-[9px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer capitalize ${
                      framework === lib ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lib}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 relative">
              <pre className="font-mono text-[11px] leading-relaxed select-all overflow-x-auto text-indigo-200 max-h-56 pb-2">
                <code>{getCodeSnippet()}</code>
              </pre>
              
              <button
                onClick={copyConfigSnippet}
                className="absolute right-3.5 bottom-3.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-lg text-[9px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider shadow-xs"
              >
                <Copy className="h-3 w-3" /> {copied ? 'COPIED!' : 'COPY TEMPLATE'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Alignment Analyzer Score and Checklist */}
        <div className="lg:col-span-5 space-y-4">
          <span className="text-xs font-bold text-slate-500 block uppercase font-mono tracking-wider">Alignment Rating Overview</span>
          
          {/* Circular dial rating card */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col items-center text-center space-y-4">
            <div className="relative flex items-center justify-center">
              {/* Outer Ring dial indicator */}
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke="#f1f5f9"
                  strokeWidth="8"
                  fill="transparent"
                />
                <motion.circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke={score === 100 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 48 - (2 * Math.PI * 48 * (score || 1)) / 100 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black font-mono tracking-tighter text-slate-800">
                  {score}%
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Sync Rate
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-800 uppercase font-mono">
                {score === 100 ? '✅ Seamlessly Confirmed' : score >= 50 ? '⚠️ Partially Confirmed' : '❌ Out of Alignment'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-normal max-w-xs font-sans">
                {score === 100 
                  ? 'Your manual EVM deployment specifications align indexable variables perfectly on Arc Testnet. This boilerplate code can be deployed safely!' 
                  : 'We detected mismatched values in your active setup parameters. Transactions or deployment configurations may target the wrong network.'}
              </p>
            </div>
          </div>

          {/* Interactive Checklist validation breakdown */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden divide-y-2 divide-slate-100 shadow-xs">
            {validationList.map((val) => {
              const severityColorClass =
                val.status === 'valid'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : val.status === 'warning'
                  ? 'text-amber-700 bg-amber-50 border-amber-100'
                  : val.status === 'invalid'
                  ? 'text-red-700 bg-red-50 border-red-100'
                  : 'text-slate-500 bg-slate-50 border-slate-100';

              return (
                <div key={val.key} className="p-4 space-y-1 hover:bg-slate-50/55 transition-colors font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{val.label}</span>
                    <span className={`text-[8px] font-mono font-black uppercase tracking-wider px-2 py-0.5 border rounded ${severityColorClass} flex items-center gap-1`}>
                      {val.status === 'valid' && <Check className="h-2.5 w-2.5" />}
                      {val.status === 'warning' && <AlertTriangle className="h-2.5 w-2.5" />}
                      {val.status === 'invalid' && <X className="h-2.5 w-2.5" />}
                      {val.status === 'missing' && <Info className="h-2.5 w-2.5" />}
                      {val.status}
                    </span>
                  </div>
                  
                  <div className="space-y-1 pt-1.5">
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono leading-tight">
                      <div className="bg-slate-50 border border-slate-100 rounded-md p-1">
                        <span className="text-[8px] text-slate-400 font-sans block leading-none pb-0.5">Your Input:</span>
                        <span className={val.foundValue ? 'text-slate-700 font-bold break-all' : 'text-slate-350 italic'}>
                          {val.foundValue !== null && val.foundValue !== '' ? String(val.foundValue) : 'Empty'}
                        </span>
                      </div>
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-md p-1 relative group">
                        <span className="text-[8px] text-indigo-400 font-sans block leading-none pb-0.5">Required:</span>
                        <span className="text-indigo-700 font-extrabold break-all">{String(val.expectedValue)}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans leading-relaxed pt-1 select-none">
                      {val.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
