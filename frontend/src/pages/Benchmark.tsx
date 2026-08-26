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
  CheckCircle2,
  Info,
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
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (score >= 700) {
      return {
        tier: 'High Performance',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    if (score >= 550) {
      return {
        tier: 'Balanced / Mainstream',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }
    return {
      tier: 'Entry / Budget Level',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  };

  const score = benchmarkResult?.score ?? null;
  const breakdown = benchmarkResult?.breakdown ?? null;
  const tierInfo = score !== null ? getTierInfo(score) : null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Banner & Action */}
      <div className="app-panel p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 flex-shrink-0 mt-0.5">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Synthetic Benchmark Suite</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                  Subsystem Stress
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl font-normal">
                Safe, software-based multi-component performance test measuring CPU math, disk I/O, and GPU acceleration.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onRunBenchmark}
            disabled={!isConnected || isBenchmarking}
            className="btn-primary min-w-[150px]"
          >
            {isBenchmarking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Suite...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Benchmark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Safety Verification Badge Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-md bg-white border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="font-normal">Non-Destructive Workload</span>
        </div>
        <div className="p-2.5 rounded-md bg-white border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="font-normal">Safe Bounded Duration</span>
        </div>
        <div className="p-2.5 rounded-md bg-white border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="font-normal">No Kernel Drivers</span>
        </div>
        <div className="p-2.5 rounded-md bg-white border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="font-normal">Zero Settings Changed</span>
        </div>
      </div>

      {/* In-Progress Live Status Indicator */}
      {isBenchmarking && (
        <div className="p-5 rounded-lg bg-blue-50/70 border border-blue-200 text-center">
          <div className="inline-flex items-center gap-2 text-blue-900 text-xs font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Executing Synthetic CPU Math, Disk I/O, and GPU Projection Tests...</span>
          </div>
          <p className="text-xs text-blue-700/80 mt-1 font-normal">
            Sampling execution throughput. The benchmark completes in approximately 2–4 seconds.
          </p>
        </div>
      )}

      {/* Benchmark Results Display */}
      {score !== null && breakdown && (
        <div className="space-y-4">
          {/* Main Composite Score Card */}
          <div className="app-panel p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Composite Performance Index
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${tierInfo?.badgeClass}`}>
                    {tierInfo?.tier}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-semibold text-slate-900 tracking-tight tabular-nums">
                    {score}
                  </span>
                  <span className="text-sm font-normal text-slate-400">/ 1000</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-normal">
                  Calibrated against reference desktop hardware baselines.
                </p>
              </div>

              {/* Summary Meter */}
              <div className="w-full md:w-72 space-y-1.5 bg-slate-50 p-3.5 rounded-md border border-slate-200">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-normal">Relative Capacity</span>
                  <span className="text-slate-900 font-medium tabular-nums">{Math.round((score / 1000) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(5, (score / 1000) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0 (Baseline)</span>
                  <span>1000 (Elite)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Component Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* CPU Component */}
            <div className="app-panel p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-semibold text-slate-900">CPU Compute</h3>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    40% Weight
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-normal">
                  Multi-threaded prime sieve, matrix transforms, and trigonometry ops.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-slate-400 font-normal">Score</span>
                  <span className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {breakdown.cpu} <span className="text-xs text-slate-400 font-normal">/ 1000</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (breakdown.cpu / 1000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Storage Component */}
            <div className="app-panel p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-semibold text-slate-900">Storage I/O</h3>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    30% Weight
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-normal">
                  Sequential read/write throughput and random block seek latency.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-slate-400 font-normal">Score</span>
                  <span className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {breakdown.disk} <span className="text-xs text-slate-400 font-normal">/ 1000</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (breakdown.disk / 1000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* GPU Component */}
            <div className="app-panel p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-semibold text-slate-900">Graphics (GPU)</h3>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    30% Weight
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-normal">
                  3D vertex matrix projection rate and hardware compute acceleration.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-slate-400 font-normal">Score</span>
                  <span className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {breakdown.gpu} <span className="text-xs text-slate-400 font-normal">/ 1000</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all duration-700"
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
        <div className="app-panel p-12 text-center">
          <Gauge className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-80" />
          <h3 className="text-sm font-semibold text-slate-900">No Benchmark Results Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto font-normal">
            Click &quot;Run Benchmark&quot; above to test your machine&apos;s synthetic compute throughput across CPU, Storage, and GPU subsystems.
          </p>
        </div>
      )}

      {/* Methodology Info Box */}
      <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <div className="font-normal">
          <span className="font-medium text-slate-700">Testing Methodology: </span>
          Scores are calibrated against standard reference hardware baselines using pure user-space software routines.
          All tests run within bounded timeframes with automatic cleanup and do not modify system configuration.
        </div>
      </div>
    </div>
  );
};
