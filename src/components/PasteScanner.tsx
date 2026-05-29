/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NetworkConfig, ParsedConfig, ValidationItem } from '../types';
import { parsePastedText, validateConfig, OFFICIAL_ARC_TESTNET } from '../lib/arcConfig';
import { Check, AlertTriangle, X, Info, FileCode, CheckCircle2, Copy, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PRESET_SAMPLES = {
  hardhat: `// hardhat.config.js
module.exports = {
  solidity: "0.8.24",
  networks: {
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};`,
  foundry: `# foundry.toml
[profile.default]
src = "src"
out = "out"

[rpc_endpoints]
arc_testnet = "https://rpc.testnet.arc.network"`,
  dotenv: `# .env configuration
PRIVATE_KEY="0xabc123..."
RPC_URL="https://rpc.testnet.arc.network"
CHAIN_ID=5042002
GAS_TOKEN="USDC"
EXPLORER_URL="https://testnet.arcscan.app"`,
  wagmi: `// wagmi & viem chain config (React / Next.js)
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
});`,
  json: `{
  "chainName": "Arc Testnet",
  "chainId": 5042002,
  "rpcUrl": "https://rpc.testnet.arc.network",
  "nativeCurrency": {
    "name": "USDC",
    "symbol": "USDC",
    "decimals": 18
  },
  "blockExplorers": [
    {
      "name": "ArcScan",
      "url": "https://testnet.arcscan.app"
    }
  ]
}`,
  ethers: `// ethers.js v6 setup
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  "https://rpc.testnet.arc.network",
  {
    chainId: 5042002,
    name: "Arc Testnet"
  }
);`,
  hardhat_deploy: `// scripts/deploy.js (Hardhat Contract Deployment Task)
const hre = require("hardhat");

async function main() {
  console.log("Starting deployment on Arc Testnet...");
  
  // Connect to Arc Testnet canonical endpoints
  const rpcUrl = "https://rpc.testnet.arc.network";
  const chainId = 5042002;
  const provider = new hre.ethers.JsonRpcProvider(rpcUrl, chainId);

  const ArcContract = await hre.ethers.getContractFactory("ArcDapp");
  const contract = await ArcContract.deploy({
    gasLimit: 8000000 // Ensure valid fee limit for USDC payment
  });

  await contract.waitForDeployment();
  console.log("Success! Contract deployed on Arc Testnet:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`,
  foundry_deploy: `// script/Deploy.s.sol (Foundry Deploy Script)
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Connect and deploy on Arc Testnet
        vm.startBroadcast(deployerPrivateKey);
        
        // MyContract token = new MyContract();
        
        vm.stopBroadcast();
    }
}`,
  broken_hardhat: `// Incorrect Hardhat Setup (Common developer mistakes)
module.exports = {
  networks: {
    arc: {
      url: "https://rpc.arc.network", // WRONG: Points to mainnet or slow node
      chainId: 1243, // WRONG: Chain ID 1243 is inactive, must be 5042002
      symbol: "ARC", // INFO: Symbol is fine, but gas is settled in USDC
      explorer: "https://etherscan.io" // WRONG: Incorrect block explorer!
    }
  }
};`
};

export default function PasteScanner({ onParsed }: { onParsed: (parsed: ParsedConfig) => void }) {
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedConfig | null>(null);
  const [validations, setValidations] = useState<ValidationItem[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!pasteText.trim()) {
      setParsed(null);
      setValidations([]);
      return;
    }

    const result = parsePastedText(pasteText);
    setParsed(result);
    onParsed(result);

    const validationList = validateConfig(result, pasteText);
    setValidations(validationList);
  }, [pasteText, onParsed]);

  const insertPreset = (key: keyof typeof PRESET_SAMPLES) => {
    setPasteText(PRESET_SAMPLES[key]);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Counting matching score
  const matchesCount = validations.filter(v => v.status === 'valid').length;
  const warningsCount = validations.filter(v => v.status === 'warning').length;
  const errorsCount = validations.filter(v => v.status === 'invalid').length;

  const rpcValidation = validations.find(v => v.key === 'rpcUrl');
  const hasCorrectRpc = rpcValidation && rpcValidation.status === 'valid';

  // Compute percentage match based on presence of correct RPC Url from active/scanned parameters
  const evaluatedCount = validations.filter(v => v.status !== 'missing').length || 1;
  const alignScore = hasCorrectRpc ? Math.round((matchesCount / evaluatedCount) * 100) : 0;
  const isMismatched = !hasCorrectRpc;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <FileCode className="h-5 w-5 text-indigo-500" />
          Project File Config Inspector
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-sans">
          Paste configuration snippets (e.g. from <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono font-bold">hardhat.config.js</code>, 
          <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono font-bold">foundry.toml</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono font-bold">.env</code>) to verify parameters dynamically.
        </p>
      </div>

      {/* Preset selections */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Try Presets:</span>
        <button
          id="btn-preset-hardhat"
          onClick={() => insertPreset('hardhat')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          ✅ Hardhat config
        </button>
        <button
          id="btn-preset-foundry"
          onClick={() => insertPreset('foundry')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          ✅ Foundry toml
        </button>
        <button
          id="btn-preset-dotenv"
          onClick={() => insertPreset('dotenv')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          ✅ DotEnv Setup
        </button>
        <button
          id="btn-preset-wagmi"
          onClick={() => insertPreset('wagmi')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          ✅ Viem / Wagmi
        </button>
        <button
          id="btn-preset-json"
          onClick={() => insertPreset('json')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          ✅ Raw JSON node
        </button>
        <button
          id="btn-preset-ethers"
          onClick={() => insertPreset('ethers')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          ✅ Ethers.js
        </button>
        <button
          id="btn-preset-hardhat-deploy"
          onClick={() => insertPreset('hardhat_deploy')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          🚀 Hardhat Deploy Script
        </button>
        <button
          id="btn-preset-foundry-deploy"
          onClick={() => insertPreset('foundry_deploy')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-75 rounded-lg transition-colors border-2 border-slate-200 cursor-pointer"
        >
          🚀 Foundry Deploy Script
        </button>
        <button
          id="btn-preset-broken"
          onClick={() => insertPreset('broken_hardhat')}
          className="text-[11px] font-mono font-semibold px-2.5 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border-2 border-amber-200 rounded-lg cursor-pointer"
        >
          ⚠️ Broken Config
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Area */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 tracking-tight flex items-center gap-1.5 font-mono uppercase">
              Paste Code Snippet
              {parsed && (
                <span className="bg-indigo-600 text-white text-[10px] uppercase font-mono px-2 py-0.5 rounded tracking-widest leading-none font-bold">
                  Format: {parsed.detectedType}
                </span>
              )}
            </span>
            {pasteText && (
              <button
                id="btn-clear-paste"
                onClick={() => setPasteText('')}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold tracking-wider font-mono transition-colors border-2 border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded-lg cursor-pointer bg-white"
              >
                Clear
              </button>
            )}
          </div>
          <div className="relative rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden shadow-xs focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <textarea
              id="config-input-textarea"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Paste config parameters here...
e.g.
RPC_URL="https://rpc.testnet.arc.network"
CHAIN_ID=5042002
GAS_TOKEN="USDC"`}
              className="w-full h-80 p-4 font-mono text-xs bg-transparent border-none outline-none resize-none text-slate-800 placeholder-slate-400 focus:ring-0 leading-relaxed"
            />
            {!pasteText && (
              <div className="absolute right-3.5 bottom-3.5 pointer-events-none text-[10px] text-slate-400 flex items-center gap-1 font-mono font-bold tracking-wider uppercase">
                <Sparkles className="h-3 w-3 text-indigo-500" /> Ready for Parsing
              </div>
            )}
          </div>
        </div>

        {/* Real-time Insights Area */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-xs font-bold text-slate-500 block uppercase font-mono tracking-wider">Analysis Insights</span>

          <AnimatePresence mode="wait">
            {!pasteText ? (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-80 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-white"
              >
                <Info className="h-8 w-8 text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-sm font-bold text-slate-600 font-mono uppercase tracking-wider">Pending Input</p>
                <p className="text-xs text-slate-400 max-w-[240px] mt-1 font-sans">
                  Paste code on the left or select a preset to analyze parameters instantly inside the auditor.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="result-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                {/* Score badge / general indicator */}
                <div id="paste-score-panel" className={`border-2 rounded-3xl p-5 shadow-sm flex flex-col gap-3 font-sans overflow-hidden ${
                  alignScore === 100 
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-950'
                    : isMismatched
                    ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                    : 'bg-amber-50 border-amber-250 text-amber-950'
                }`}>
                  <div className="flex items-center justify-between font-mono">
                    <div>
                      <p className={`text-[10px] uppercase font-black tracking-widest ${
                        alignScore === 100 ? 'text-emerald-700' : isMismatched ? 'text-rose-600' : 'text-amber-800'
                      }`}>
                        Target Alignment Matches
                      </p>
                      <div className="flex items-baseline gap-1 mt-1 font-sans">
                        <span className="text-3xl font-black tracking-tight">{alignScore}%</span>
                        <span className="text-[10px] font-bold font-mono">MATCHED</span>
                      </div>
                    </div>
                    <div>
                      {alignScore === 100 ? (
                        <span className="flex items-center gap-1.5 text-xs font-black bg-emerald-150 text-emerald-850 px-3 py-1.5 rounded-xl border border-emerald-350 uppercase tracking-widest">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> ALIGNED
                        </span>
                      ) : isMismatched ? (
                        <span className="flex items-center gap-1.5 text-xs font-black bg-rose-100 text-rose-800 px-3 py-1.5 rounded-xl border border-rose-300 uppercase tracking-widest animate-pulse">
                          <AlertTriangle className="h-4 w-4 text-rose-650" /> MISMATCHED / OFFLINE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-black bg-amber-100 text-amber-850 px-3 py-1.5 rounded-xl border border-amber-300 uppercase tracking-widest">
                          <AlertTriangle className="h-4 w-4 text-amber-650" /> PARTIAL
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`text-[11px] leading-relaxed border p-3 rounded-2xl ${
                    alignScore === 100 
                      ? 'border-emerald-200 bg-emerald-100/30' 
                      : isMismatched 
                      ? 'border-rose-200 bg-rose-100/30'
                      : 'border-amber-200 bg-amber-100/30'
                  }`}>
                    {alignScore === 100 ? (
                      <div>
                        🏆 <b>Perfect Harmony!</b> Your configuration code is fully compliant with the <b>Arc Testnet</b>. The nodes, chain limits, and settlement protocols are perfectly synchronized.
                      </div>
                    ) : isMismatched ? (
                      <div>
                        ❌ <b>Core Mismatch Detected!</b> None of the searched configuration variables contain the correct Arc Testnet RPC URL (<code className="bg-rose-100 text-rose-900 rounded px-1 font-bold">{OFFICIAL_ARC_TESTNET.rpcUrl}</code>). Score is set to <b>0%</b>. Correct this setting to sync and deploy properly.
                      </div>
                    ) : (
                      <div>
                        ⚠️ <b>Partial Setup Alert:</b> Your script targets the correct RPC node URL, but minor configuration parameters (such as the block explorer link or the native gas currency ticker) are sub-optimal. Let's fix those below!
                      </div>
                    )}
                  </div>
                </div>

                {/* Scanned breakdown */}
                <div className="bg-white border-2 border-slate-200 rounded-2xl divide-y-2 divide-slate-100 overflow-hidden shadow-xs">
                  {validations.map((v) => {
                    const statusClass =
                      v.status === 'valid'
                        ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
                        : v.status === 'warning'
                        ? 'text-amber-700 bg-amber-150 border-amber-250'
                        : v.status === 'invalid'
                        ? 'text-red-700 bg-red-100 border-red-200'
                        : 'text-slate-600 bg-slate-100 border-slate-200';

                    return (
                      <div key={v.key} className="p-4 flex flex-col gap-1 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 font-sans tracking-tight">{v.label}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold border font-mono tracking-wider uppercase flex items-center gap-1 ${statusClass}`}>
                            {v.status === 'valid' && <Check className="h-2.5 w-2.5" />}
                            {v.status === 'warning' && <AlertTriangle className="h-2.5 w-2.5" />}
                            {v.status === 'invalid' && <X className="h-2.5 w-2.5" />}
                            {v.status === 'missing' && <Info className="h-2.5 w-2.5" />}
                            {v.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-2 font-mono text-[11px] leading-tight text-slate-500 border-t border-slate-100 pt-2 pb-1">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Scanned:</span>
                            <span className={v.foundValue ? "text-slate-800 font-semibold break-all bg-slate-50 px-1 py-0.5 rounded border border-slate-150 block" : "text-slate-300 italic block py-0.5"}>
                              {v.foundValue !== null ? String(v.foundValue) : 'Not detected'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Target Spec:</span>
                            <span className="text-slate-800 break-all flex items-center justify-between gap-1 group bg-slate-50 px-1 py-0.5 rounded border border-slate-150">
                              <span className="font-semibold">{String(v.expectedValue)}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(String(v.expectedValue), v.key)}
                                className="text-[9px] font-sans bg-white border border-slate-200 text-slate-600 py-0.5 px-1.5 rounded hover:bg-slate-100 cursor-pointer shrink-0 transition-all font-bold"
                              >
                                {copiedKey === v.key ? 'Copied' : 'Copy'}
                              </button>
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] font-sans text-slate-500 mt-2 leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-150">
                          {v.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
