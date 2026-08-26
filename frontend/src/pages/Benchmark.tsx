import React from 'react';
import { BenchmarkResult } from '../types/telemetry';
import {
  Gauge,
  Cpu,
  HardDrive,
  Tv,
  Play,
  Loader2,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface BenchmarkProps {
  benchmarkResult: BenchmarkResult | null;
  isBenchmarking: boolean;
  onRunBenchmark: () => void;
  isConnected: boolean;
}

export const Benchmark: React.FC<BenchmarkProps> = ({
  benchmarkResult,
  isBenchmarking,
  onRunBenchmark,
  isConnected,
}) => {
  const getTierInfo = (score: number) => {
    if (score >= 850) {
      return {
        tier: 'Elite Performance',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        glow: 'glow-emerald',
      };
    }
    if (score >= 700) {
      return {
        tier: 'High Performance',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        glow: 'glow-cyan',
      };
    }
    if (score >= 550) {
      return {
        tier: 'Balanced / Mainstream',
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/30',
        glow: 'glow-indigo',
      };
    }
    return {
      tier: 'Entry / Budget Level',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      glow: 'glow-amber',
    };
  };

  const score = benchmarkResult?.score ?? null;
  const breakdown = benchmarkResult?.breakdown ?? null;
  const tierInfo = score !== null ? getTierInfo(score) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center glow-cyan">
            <Gauge className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Synthetic Benchmark Mode</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                Phase 6
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Safe, software-based multi-component performance testing for CPU, Storage, and GPU.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onRunBenchmark}
          disabled={!isConnected || isBenchmarking}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 shadow-lg ${
            isBenchmarking
              ? 'bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 cursor-not-allowed'
              : !isConnected
              ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white glow-cyan'
          }`}
        >
          {isBenchmarking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Running Synthetic Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current text-cyan-300" />
              <span>Run Benchmark</span>
            </>
          )}
        </button>
      </div>

      {/* Safety Verification Badge Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Non-Destructive Workload</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Safe Bounded Duration</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>No Kernel Driver Needed</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Zero System Settings Changed</span>
        </div>
      </div>

      {/* In-Progress Live Status Indicator */}
      {isBenchmarking && (
        <div className="p-6 rounded-2xl glass-card border border-cyan-500/40 bg-cyan-950/20 text-center animate-pulse">
          <div className="inline-flex items-center gap-3 text-cyan-300 text-sm font-medium">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Executing Synthetic CPU Math, Disk I/O, and GPU Projection Tests...</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Sampling execution throughput. The benchmark completes in approximately 2–3 seconds.
          </p>
        </div>
      )}

      {/* Benchmark Results Display */}
      {score !== null && breakdown && (
        <div className="space-y-6">
          {/* Main Composite Score Hero */}
          <div className={`p-8 rounded-2xl glass-card border ${tierInfo?.border} ${tierInfo?.bg} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Zap className="w-48 h-48 text-white" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-300 mb-3">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Composite Performance Index</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-black text-white tracking-tight font-mono">
                    {score}
                  </span>
                  <span className="text-xl font-bold text-slate-400">/ 1000</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-base font-bold ${tierInfo?.color}`}>
                    {tierInfo?.tier}
                  </span>
                  <span className="text-xs text-slate-400">&bull; Standard Benchmark Weighting</span>
                </div>
              </div>

              {/* Quick Summary Meter */}
              <div className="w-full md:w-80 space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Relative Performance</span>
                  <span className="font-mono text-white">{Math.round((score / 1000) * 100)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, Math.max(10, (score / 1000) * 100))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-right">Scale: 0 (Baseline) to 1000 (Elite)</p>
              </div>
            </div>
          </div>

          {/* Component Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* CPU Component */}
            <div className="p-6 rounded-2xl glass-card border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Cpu className="w-6 h-6 text-indigo-400" />
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    40% Weight
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">CPU Performance</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Multi-threaded prime sieve, trigonometry, and matrix arithmetic ops.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs text-slate-400">Score</span>
                  <span className="text-2xl font-black text-indigo-400 font-mono">
                    {breakdown.cpu} <span className="text-xs text-slate-500">/ 1000</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (breakdown.cpu / 1000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Storage Component */}
            <div className="p-6 rounded-2xl glass-card border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <HardDrive className="w-6 h-6 text-cyan-400" />
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    30% Weight
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Storage I/O Speed</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Sequential write/read throughput and random block seek latency.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs text-slate-400">Score</span>
                  <span className="text-2xl font-black text-cyan-400 font-mono">
                    {breakdown.disk} <span className="text-xs text-slate-500">/ 1000</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (breakdown.disk / 1000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* GPU Component */}
            <div className="p-6 rounded-2xl glass-card border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <Tv className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    30% Weight
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">GPU Graphics &amp; Compute</h3>
                <p className="text-xs text-slate-400 mt-1">
                  3D vertex matrix projection rate and hardware compute acceleration.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs text-slate-400">Score</span>
                  <span className="text-2xl font-black text-purple-400 font-mono">
                    {breakdown.gpu} <span className="text-xs text-slate-500">/ 1000</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (breakdown.gpu / 1000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty / Not Run Yet State */}
      {score === null && !isBenchmarking && (
        <div className="p-12 text-center rounded-2xl glass-card border border-slate-800">
          <Gauge className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Benchmark Results Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Click "Run Benchmark" above to test your machine's synthetic compute throughput across CPU, Storage, and GPU subsystems.
          </p>
        </div>
      )}

      {/* Methodology Info Box */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-300">Testing Methodology: </span>
          Scores are calibrated against standard reference hardware baselines using pure user-space software routines.
          All tests run within bounded timeframes with automatic cleanup and do not interfere with system stability.
        </div>
      </div>
    </div>
  );
};
