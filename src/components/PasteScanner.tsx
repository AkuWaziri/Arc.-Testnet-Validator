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

    const validationList = validateConfig(result);
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
                <div className="bg-slate-900 border-2 border-slate-800 text-white rounded-2xl p-4.5 shadow-sm flex items-center justify-between font-mono">
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Target Verification Score</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-black text-indigo-400 tracking-tight">{matchesCount}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-xs font-bold text-slate-300">4 checks passed</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {errorsCount > 0 ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold bg-amber-950 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-800 uppercase tracking-wider">
                        <X className="h-3 w-3" /> {errorsCount} Error{errorsCount > 1 ? 's' : ''}
                      </span>
                    ) : warningsCount > 0 ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold bg-amber-950 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-800 uppercase tracking-wider">
                        <AlertTriangle className="h-3 w-3" /> {warningsCount} Hint{warningsCount > 1 ? 's' : ''}
                      </span>
                    ) : matchesCount === 4 ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-800 uppercase tracking-wider">
                        <Check className="h-3 w-3" /> Perfect Set
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 border border-slate-700 px-2.5 py-1 rounded-lg bg-slate-800 font-bold uppercase tracking-wider">
                        Partial
                      </span>
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
