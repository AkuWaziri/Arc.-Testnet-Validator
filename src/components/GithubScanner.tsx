/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { parsePastedText, validateConfig, OFFICIAL_ARC_TESTNET } from '../lib/arcConfig';
import { ValidationItem, ParsedConfig } from '../types';
import { 
  Github, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Terminal, 
  FileCode2, 
  GitFork, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  AlertTriangle, 
  Globe, 
  Settings, 
  Cpu, 
  BookOpen, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FoundFileReport {
  path: string;
  type: string;
  content: string;
  parsed: ParsedConfig;
  validation: ValidationItem[];
}

const COMMON_CONFIG_PATHS = [
  'hardhat.config.ts',
  'hardhat.config.js',
  'hardhat.config.cjs',
  'foundry.toml',
  '.env.example',
  '.env',
  'package.json',
  'wagmi.config.ts',
  'wagmi.config.js'
];

export default function GithubScanner() {
  const [repoUrl, setRepoUrl] = useState('');
  const [customBranch, setCustomBranch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    owner: string;
    repo: string;
    branch: string;
    filesScanned: FoundFileReport[];
    score: number;
    aligned: boolean;
  } | null>(null);
  const [expandedFileIdx, setExpandedFileIdx] = useState<number | null>(null);

  // Parse GitHub URL into Owner, Repo, and optional branch
  const parseGithubUrl = (url: string) => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    
    // Regular expression for standard public github URLs
    // matches: https://github.com/owner/repo or github.com/owner/repo
    const regex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)(?:\/(?:tree|blob)\/([a-zA-Z0-9-._]+))?/;
    const match = cleanUrl.match(regex);
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        urlBranch: match[3] || null
      };
    }
    
    // Fallback if they just type owner/repo
    const simpleRegex = /^([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)$/;
    const simpleMatch = cleanUrl.match(simpleRegex);
    if (simpleMatch) {
      return {
        owner: simpleMatch[1],
        repo: simpleMatch[2],
        urlBranch: null
      };
    }
    
    return null;
  };

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setScanResult(null);
    setScanProgress([]);
    
    const parsedRepo = parseGithubUrl(repoUrl);
    if (!parsedRepo) {
      setErrorMsg('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo or owner/repo).');
      return;
    }

    const { owner, repo, urlBranch } = parsedRepo;
    const branch = customBranch.trim() || urlBranch || 'main'; // try specified, url branch, then default to main
    
    setIsLoading(true);
    setScanProgress(['Connecting to GitHub API...', `Targeting repository: ${owner}/${repo} on branch: ${branch}`]);

    let detectedFiles: FoundFileReport[] = [];

    try {
      // Step 1: Detect branch existence or fetch tree listing of files
      // We can query Github API trees endpoint
      setScanProgress(prev => [...prev, 'Fetching file structure recursive tree...']);
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      
      let allPaths: string[] = [];
      let isRateLimited = false;

      try {
        const response = await fetch(treeUrl);
        if (response.status === 403 || response.status === 429) {
          isRateLimited = true;
          setScanProgress(prev => [...prev, '⚠️ GitHub API rate limit hit. Switching to high-speed Raw Fallback scanner...']);
        } else if (!response.ok) {
          // If custom branch is master, try 'master' default if main failed
          if (branch === 'main') {
            setScanProgress(prev => [...prev, 'Repository branch "main" not encountered. Testing fallback branch "master"...']);
            const fallbackTreeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
            const fbResponse = await fetch(fallbackTreeUrl);
            if (fbResponse.ok) {
              const fbData = await fbResponse.json();
              allPaths = fbData.tree.map((f: any) => f.path);
            }
          }
          
          if (allPaths.length === 0) {
            setScanProgress(prev => [...prev, `Could not retrieve file structure via API (${response.statusText}). Reverting to preset configs.`]);
          }
        } else {
          const data = await response.json();
          if (data.tree && Array.isArray(data.tree)) {
            allPaths = data.tree.map((item: any) => item.path);
            setScanProgress(prev => [...prev, `Retrieved tree structure specifying ${allPaths.length} objects.`]);
          }
        }
      } catch (err) {
        setScanProgress(prev => [...prev, 'Network issue querying GitHub API. Checking common config paths directly...']);
      }

      // If we couldn't list the files or are rate-limited, default to standard preset file check list directly.
      const filesToInspect = allPaths.length > 0 
        ? allPaths.filter(p => COMMON_CONFIG_PATHS.some(cp => p.endsWith(cp)))
        : COMMON_CONFIG_PATHS;

      if (filesToInspect.length === 0) {
        throw new Error('No common EVM config files discovered in the retrieved repository file tree structure.');
      }

      setScanProgress(prev => [...prev, `Auditing matched configuration files (${filesToInspect.length} spotted)...`]);

      // Step 2: Fetch and audit file contents from Raw GitHub CDN
      const activeBranch = allPaths.length > 0 ? branch : (branch === 'main' ? 'main' : branch);
      
      const checkAndFetchFile = async (filePath: string, currentBranch: string): Promise<FoundFileReport | null> => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${currentBranch}/${filePath}`;
        try {
          const res = await fetch(rawUrl);
          if (res.ok) {
            const content = await res.text();
            
            // Recapture configuration
            const parsed = parsePastedText(content);
            const validation = validateConfig(parsed);
            
            return {
              path: filePath,
              type: parsed.detectedType,
              content,
              parsed,
              validation
            };
          }
        } catch {}
        return null;
      };

      for (const filePath of filesToInspect) {
        setScanProgress(prev => [...prev, `Reading file: ${filePath}...`]);
        let report = await checkAndFetchFile(filePath, activeBranch);
        
        // If 'main' branch content fetch failed, try fallback to 'master' if we didn't use fallback tree already
        if (!report && activeBranch === 'main') {
          report = await checkAndFetchFile(filePath, 'master');
        }
        
        if (report && report.type !== 'unknown') {
          detectedFiles.push(report);
        }
      }

      if (detectedFiles.length === 0) {
        // Double check standard root config files specifically
        setScanProgress(prev => [...prev, 'Searching root directory configuration snippets...']);
        for (const filePath of COMMON_CONFIG_PATHS) {
          const report = await checkAndFetchFile(filePath, branch);
          if (report && report.type !== 'unknown') {
            detectedFiles.push(report);
          }
        }
      }

      if (detectedFiles.length === 0) {
        throw new Error(`Repository verified, but no valid web3/EVM or deployment configuration details parsed (e.g. hardhat.config.ts, foundry.toml, .env.example) on branch "${branch}".`);
      }

      // Step 3: Compute alignment configurations score
      let totalChecks = 0;
      let correctChecks = 0;
      let hasCriticalMismatch = false;

      // Ensure duplicates or empty audits don't skew stats
      detectedFiles.forEach(file => {
        file.validation.forEach(item => {
          if (item.status === 'valid') {
            correctChecks++;
          } else if (item.status === 'invalid' && (item.key === 'chainId' || item.key === 'rpcUrl')) {
            hasCriticalMismatch = true;
          }
          totalChecks++;
        });
      });

      const score = totalChecks > 0 ? Math.round((correctChecks / totalChecks) * 100) : 100;
      const aligned = !hasCriticalMismatch && score >= 75;

      setScanResult({
        owner,
        repo,
        branch: activeBranch,
        filesScanned: detectedFiles,
        score,
        aligned
      });

      setScanProgress(prev => [...prev, '✓ Audit completed successfully! System compiled diagnostics output.']);
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred while connecting or fetching files from GitHub. Please confirm the repo is public, target branch name exists, and paths align.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Github className="h-5 w-5 text-indigo-500" />
          Git-Connect Project Auditor & Repository Scanner
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-sans">
          Provide a link to any public GitHub smart contract workspace. Our engine recursively scans codebase configs (Hardhat, Foundry, Wagmi, Dotenv), parsing deployment keys to verify zero mismatches with Arc Testnet standard parameters.
        </p>
      </div>

      <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 lg:p-6 shadow-xs">
        <form onSubmit={handleAudit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8 space-y-2">
              <label htmlFor="repo-url" className="text-[10px] font-bold text-slate-400 block font-mono uppercase tracking-widest">Public GitHub Repo Link or Handle</label>
              <div className="relative flex items-center">
                <Github className="absolute left-3.5 h-4 w-4 text-slate-400" />
                <input
                  id="repo-url"
                  type="text"
                  placeholder="https://github.com/username/my-contracts-project"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-300"
                />
              </div>
            </div>
            
            <div className="md:col-span-2 space-y-2">
              <label htmlFor="branch-name" className="text-[10px] font-bold text-slate-400 block font-mono uppercase tracking-widest">Branch (Optional)</label>
              <div className="relative flex items-center">
                <GitFork className="absolute left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="branch-name"
                  type="text"
                  placeholder="main"
                  value={customBranch}
                  onChange={(e) => setCustomBranch(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-8 pr-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-300"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isLoading || !repoUrl}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0 font-mono"
              >
                {isLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Audit Repo
              </button>
            </div>
          </div>
        </form>

        {/* Loading Progress Terminal */}
        {isLoading && (
          <div className="mt-5 p-4 bg-slate-900 text-slate-300 rounded-xl font-mono text-[11px] space-y-1 shadow-inner max-h-[180px] overflow-y-auto border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-indigo-400">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <Terminal className="h-3.5 w-3.5" /> Auditing Terminal Logs:
              </span>
              <span className="animate-pulse">● RUNNING...</span>
            </div>
            {scanProgress.map((line, idx) => (
              <div key={idx} className="flex gap-2 leading-relaxed">
                <span className="text-slate-650 shrink-0">[{idx + 1}]</span>
                <span className={line.startsWith('✓') ? 'text-emerald-400' : line.startsWith('⚠️') ? 'text-amber-400' : ''}>{line}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="mt-5 p-4 bg-red-50 text-red-700 border-2 border-red-200 rounded-xl text-xs leading-relaxed flex gap-2 font-mono">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <div>
              <span className="font-extrabold block text-[10px] uppercase tracking-wider">Auditor Failed to Process Repo</span>
              {errorMsg}
            </div>
          </div>
        )}

        {/* Audit Accomplished Results Overview */}
        {scanResult && (
          <div className="mt-6 space-y-6">
            
            {/* Header Badge */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <Github className="h-3 w-3" /> {scanResult.owner} / {scanResult.repo} • Branch: {scanResult.branch}
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
                  Audit Report Result: Codebase Verification Complete
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  The repository environment matches are outlined below. Inspect files individually to locate parameters.
                </p>
              </div>

              {/* Compatibility Score */}
              <div className="flex items-center gap-4 shrink-0 font-mono">
                <div className="text-left">
                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest text-right">Alignment</div>
                  <div className="text-2xl font-black text-slate-800">{scanResult.score}%</div>
                </div>

                <div className={`p-3 rounded-xl border-2 shrink-0 ${
                  scanResult.aligned 
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
                    : 'bg-amber-50 border-amber-250 text-amber-800'
                }`}>
                  {scanResult.aligned ? (
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" /> ALIGNED
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-center">
                      <AlertTriangle className="h-5 w-5 text-amber-600 animate-bounce" /> MISMATCH SPOTTED
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Verdict banner */}
            {scanResult.aligned ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 border-2 border-emerald-200 rounded-2xl flex gap-3 text-xs font-sans font-medium">
                <Check className="h-4.5 w-4.5 text-emerald-650 mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold block text-emerald-950 uppercase tracking-wide text-xs">READY FOR ARC TESTNET DEPLOYMENTS! 🎉</span>
                  This repository's configuration components are successfully synced to run. The deployment scripts reference the canonical RPC node (<code className="bg-emerald-100 rounded px-1">{OFFICIAL_ARC_TESTNET.rpcUrl}</code>) and Chain ID (<code className="bg-emerald-100 rounded px-1">{OFFICIAL_ARC_TESTNET.chainId}</code>), with fees paid correctly in <code className="bg-emerald-100 rounded px-1">USDC</code>.
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 text-amber-900 border-2 border-amber-200 rounded-2xl flex gap-3 text-xs font-sans font-medium">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-extrabold block text-amber-955 uppercase tracking-wide text-xs">CONFIG CORRECTIONS REQUIRED</span>
                  Your smart contracts are currently set to communicate with a deprecated or alternative chain ID (like 1244, 1243, or a localized testnet fork). To resolve deployment failures, update all configurations to point precisely to chain <code className="bg-amber-100/70 rounded px-1 text-amber-950 font-mono font-bold">{OFFICIAL_ARC_TESTNET.chainId}</code> and use RPC endpoint <code className="bg-amber-100/70 rounded px-1 text-amber-950 font-mono font-bold">{OFFICIAL_ARC_TESTNET.rpcUrl}</code>.
                </div>
              </div>
            )}

            {/* Config files grid */}
            <div className="space-y-4">
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">Detected Configuration Manifests</h4>
              
              <div className="grid grid-cols-1 gap-4 font-mono">
                {scanResult.filesScanned.map((file, idx) => {
                  const hasMisalignment = file.validation.some(v => v.status === 'invalid' || v.status === 'warning');

                  return (
                    <div 
                      key={idx} 
                      className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white hover:border-indigo-200 transition-colors"
                    >
                      {/* Accordioned File Header */}
                      <button
                        onClick={() => setExpandedFileIdx(expandedFileIdx === idx ? null : idx)}
                        className="w-full text-left p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            hasMisalignment ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            <FileCode2 className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-800 break-all block">{file.path}</span>
                            <span className="text-[10px] text-indigo-600 uppercase block font-bold leading-normal mt-0.5">
                              Format: {file.type.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${
                            hasMisalignment ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-250'
                          }`}>
                            {hasMisalignment ? 'Warning / Outdated' : 'Aligned'}
                          </span>
                          {expandedFileIdx === idx ? (
                            <ChevronUp className="h-4 w-4 text-slate-405 shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-405 shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* Accordioned Contents */}
                      {expandedFileIdx === idx && (
                        <div className="border-t border-slate-100 bg-slate-50/30 p-4 space-y-4">
                          
                          {/* File Diagnostics */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {file.validation.map((v, vIdx) => (
                              <div 
                                key={vIdx} 
                                className={`p-3 rounded-xl border border-dashed text-left ${
                                  v.status === 'valid'
                                    ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                                    : v.status === 'invalid'
                                    ? 'bg-red-50/40 border-red-200 text-red-900'
                                    : v.status === 'warning'
                                    ? 'bg-amber-50/40 border-amber-200 text-amber-900'
                                    : 'bg-slate-100 border-slate-200 text-slate-500'
                                }`}
                              >
                                <span className="text-[8px] font-black uppercase tracking-widest block text-slate-400">
                                  {v.label}
                                </span>
                                
                                <div className="mt-1 flex flex-col justify-start gap-0.5 text-xs">
                                  <span className="truncate block font-black">
                                    Found: <code className="bg-black/5 rounded px-1 text-[10px]">{v.foundValue ? String(v.foundValue) : 'Missing'}</code>
                                  </span>
                                  <span className="text-[10px] opacity-75">
                                    Target: <code className="bg-black/5 rounded px-1 font-semibold">{v.expectedValue ? String(v.expectedValue) : 'N/A'}</code>
                                  </span>
                                </div>
                                <p className="text-[9.5px] mt-1 leading-normal font-sans border-t border-black/5 pt-1 font-medium select-none">
                                  {v.message}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Source Code View */}
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Raw Configuration Inspector</span>
                            <div className="relative text-[10px] bg-slate-900 text-slate-300 p-4 rounded-xl shadow-inner border border-slate-800 select-text overflow-x-auto leading-relaxed max-h-64">
                              <pre className="font-mono">{file.content}</pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick deployment tutorial checklist */}
            <div className="bg-indigo-950 text-indigo-200 border-2 border-indigo-900 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-400" />
                How to align your repo (Quick Reference to Fix Mismatches)
              </h4>
              <p className="text-xs text-indigo-300 font-sans">
                Below are the settings you must incorporate to synchronize your local project structure precisely with Arc Testnet requirements:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-indigo-900/40 p-4 rounded-xl border border-indigo-805/50 space-y-2">
                  <span className="text-white font-bold block bg-indigo-900/60 w-fit px-2 py-0.5 rounded text-[10px] uppercase">Dotenv File (.env)</span>
                  <pre className="text-[10.5px] text-indigo-200 space-y-0.5 select-all">
                    {`RPC_URL="https://rpc.testnet.arc.network"
CHAIN_ID=${OFFICIAL_ARC_TESTNET.chainId}
GAS_TOKEN="USDC"
EXPLORER_URL="https://testnet.arcscan.app"`}
                  </pre>
                </div>

                <div className="bg-indigo-900/40 p-4 rounded-xl border border-indigo-805/50 space-y-2">
                  <span className="text-white font-bold block bg-indigo-900/60 w-fit px-2 py-0.5 rounded text-[10px] uppercase">Foundry Config (foundry.toml)</span>
                  <pre className="text-[10.5px] text-indigo-200 space-y-0.5 select-all">
                    {`[rpc_endpoints]
arc_testnet = "${OFFICIAL_ARC_TESTNET.rpcUrl}"`}
                  </pre>
                </div>
              </div>

              <div className="border-t border-indigo-900 pt-3 flex flex-wrap gap-x-6 gap-y-2 text-[10px]">
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-indigo-400" /> Gas token settled in USDC</span>
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-indigo-400" /> EIP-3085 Compliant Client Switchers</span>
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-indigo-400" /> Verified ArcScan contracts indexing</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
