import React from 'react';
import {
  MetricsTick,
  DiagnosisResult,
  TimelineResult,
  BenchmarkResult,
} from '../types/telemetry';
import {
  FileText,
  Download,
  Loader2,
  ShieldCheck,
  Cpu,
  HardDrive,
  Tv,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  Clock,
  Gauge,
  HelpCircle,
} from 'lucide-react';


interface HealthReportProps {
  latestTick: MetricsTick | null;
  lastDiagnosis: DiagnosisResult | null;
  lastTimelineResult: TimelineResult | null;
  lastBenchmarkResult: BenchmarkResult | null;
  isExportingPdf: boolean;
  onExportPdf: () => void;
  onDiagnose: () => void;
  isConnected: boolean;
}

export const HealthReport: React.FC<HealthReportProps> = ({
  latestTick,
  lastDiagnosis,
  lastTimelineResult,
  lastBenchmarkResult,
  isExportingPdf,
  onExportPdf,
  onDiagnose,
  isConnected,
}) => {
  const diagnosis = lastDiagnosis?.diagnosis;
  const explanation = lastDiagnosis?.explanation;
  const llmSucceeded = lastDiagnosis?.llm_call_succeeded ?? false;

  const healthScore = diagnosis ? diagnosis.health_score : (latestTick ? 100 : 100);
  const severity = diagnosis?.severity ?? 'none';
  const label = diagnosis?.label ?? 'nominal';

  const getScoreBadge = () => {
    if (healthScore >= 90) {
      return {
        label: 'Optimal Health',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        glow: 'glow-emerald',
      };
    }
    if (healthScore >= 70) {
      return {
        label: 'Moderate Impact',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        glow: 'glow-amber',
      };
    }
    return {
      label: 'Critical Bottleneck',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      glow: 'glow-rose',
    };
  };

  const scoreBadge = getScoreBadge();
  const snapshotCount = lastTimelineResult?.snapshots?.length ?? 0;
  const diagnosisCount = lastTimelineResult?.diagnoses?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center glow-indigo">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">System Health Report</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                Phase 6 Report &bull; PDF Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive performance diagnostic combining real telemetry, deterministic reasoning, and AI remediation.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onDiagnose}
            disabled={!isConnected}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-all"
          >
            <Stethoscope className="w-4 h-4 text-indigo-400" />
            <span>Re-Diagnose</span>
          </button>

          <button
            onClick={onExportPdf}
            disabled={!isConnected || isExportingPdf}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs transition-all duration-300 shadow-lg ${
              isExportingPdf
                ? 'bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 cursor-not-allowed'
                : !isConnected
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white glow-indigo'
            }`}
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-cyan-300" />
                <span>Export PDF Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Health Score & Status Hero */}
      <div className={`p-8 rounded-2xl glass-card border ${scoreBadge.border} ${scoreBadge.bg} relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-300 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Overall PC Health Evaluation</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black text-white tracking-tight font-mono">
                {healthScore}
              </span>
              <span className="text-xl font-bold text-slate-400">/ 100</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-base font-bold ${scoreBadge.color}`}>
                {scoreBadge.label}
              </span>
              <span className="text-xs text-slate-400">&bull; Fired Rule: <code className="text-indigo-300">{label}</code></span>
            </div>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400">CPU Load</span>
              <p className="text-sm font-mono font-bold text-white">
                {latestTick ? `${latestTick.cpu_percent.toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400">RAM Used</span>
              <p className="text-sm font-mono font-bold text-white">
                {latestTick ? `${latestTick.ram_percent.toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400">Disk Busy</span>
              <p className="text-sm font-mono font-bold text-white">
                {latestTick ? `${latestTick.disk_percent_busy.toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400">Severity</span>
              <p className={`text-sm font-bold uppercase ${
                severity === 'high' ? 'text-rose-400' : severity === 'medium' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {severity}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Component Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Processor</span>
            </div>
            <span className="font-mono text-white">{latestTick?.cpu_percent.toFixed(1) ?? '--'}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${latestTick?.cpu_percent ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Temp: {latestTick?.cpu_temp_c ? `${latestTick.cpu_temp_c.toFixed(1)}°C` : 'N/A'}</span>
            <span>{latestTick?.per_core_percent?.length ?? '--'} Cores</span>
          </div>
        </div>

        {/* RAM */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Memory</span>
            </div>
            <span className="font-mono text-white">{latestTick?.ram_percent.toFixed(1) ?? '--'}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full"
              style={{ width: `${latestTick?.ram_percent ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Avail: {latestTick ? `${(latestTick.ram_available_mb / 1024).toFixed(1)} GB` : '--'}</span>
            <span>Swap: {latestTick?.pagefile_percent ? `${latestTick.pagefile_percent.toFixed(0)}%` : '0%'}</span>
          </div>
        </div>

        {/* Storage */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>Storage I/O</span>
            </div>
            <span className="font-mono text-white">{latestTick?.disk_percent_busy.toFixed(1) ?? '--'}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${latestTick?.disk_percent_busy ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>R: {latestTick?.disk_read_bps ? `${(latestTick.disk_read_bps / 1048576).toFixed(1)} MB/s` : '0 MB/s'}</span>
            <span>W: {latestTick?.disk_write_bps ? `${(latestTick.disk_write_bps / 1048576).toFixed(1)} MB/s` : '0 MB/s'}</span>
          </div>
        </div>

        {/* GPU */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-purple-400" />
              <span>GPU Graphics</span>
            </div>
            <span className="font-mono text-white">{latestTick?.gpu_percent ? `${latestTick.gpu_percent.toFixed(1)}%` : 'N/A'}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${latestTick?.gpu_percent ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Temp: {latestTick?.gpu_temp_c ? `${latestTick.gpu_temp_c.toFixed(0)}°C` : 'N/A'}</span>
            <span className="truncate max-w-[100px]">{latestTick?.gpu_name ?? 'Display'}</span>
          </div>
        </div>
      </div>

      {/* Deterministic Reasoning Findings */}
      <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Deterministic Rules Engine Diagnosis</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
            Sole Diagnostic Authority
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-slate-500">Diagnostic Rule ID</span>
            <p className="font-mono font-bold text-indigo-300 mt-1">{diagnosis?.rule_id ?? 'nominal'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-slate-500">Severity Classification</span>
            <p className={`font-bold uppercase mt-1 ${
              severity === 'high' ? 'text-rose-400' : severity === 'medium' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {severity}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-slate-500">Contributing Processes</span>
            <p className="font-mono text-slate-300 mt-1 truncate">
              {diagnosis?.contributing_processes?.length
                ? diagnosis.contributing_processes.join(', ')
                : 'None (Nominal distribution)'}
            </p>
          </div>
        </div>
      </div>

      {/* AI Explanation & Ranked Remediation Plan */}
      <div className="p-6 rounded-2xl glass-card border border-indigo-900/50 bg-indigo-950/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">AI Plain-English Explanation &amp; Action Plan</h3>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            llmSucceeded
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
              : 'bg-amber-950 text-amber-300 border-amber-800'
          }`}>
            {llmSucceeded ? 'AI Enhanced' : 'Rules-Engine Fallback'}
          </span>
        </div>

        {explanation ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2">
              <span className="text-slate-400 font-semibold">Executive Summary</span>
              <p className="text-slate-200 leading-relaxed">{explanation.summary}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2">
              <span className="text-slate-400 font-semibold">Underlying Root Cause</span>
              <p className="text-slate-300 leading-relaxed">{explanation.root_cause}</p>
            </div>

            {explanation.fixes && explanation.fixes.length > 0 && (
              <div className="space-y-2">
                <span className="text-slate-400 font-semibold">Ranked Remediation Steps</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {explanation.fixes.map((fix, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center font-mono text-[10px] text-indigo-300 shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-200 font-medium">{fix.action}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>Difficulty: <span className="text-slate-300 capitalize">{fix.difficulty}</span></span>
                          <span>&bull;</span>
                          <span>Impact: <span className="text-indigo-400 capitalize font-semibold">{fix.impact}</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {explanation.expected_improvement && (
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span><b>Expected Outcome: </b>{explanation.expected_improvement}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-300 font-semibold">AI explanation unavailable</p>
              <p className="text-slate-400 mt-0.5">
                Showing rules-engine diagnosis only. Click "Re-Diagnose" or configure an LLM API key in <code className="text-indigo-300">.env</code> to generate full AI writeups.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stability History & Synthetic Benchmark Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Timeline Stability Card */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Historical Stability Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500">Persistent Samples</span>
              <p className="text-lg font-bold font-mono text-white mt-0.5">{snapshotCount} ticks</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500">Recorded Incidents</span>
              <p className="text-lg font-bold font-mono text-white mt-0.5">{diagnosisCount} events</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Backed by local SQLite storage (<code className="text-slate-400">performance.db</code>) with 14-day rolling retention.
          </p>
        </div>

        {/* Benchmark Card */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>Benchmark Score Snapshot</span>
          </div>
          {lastBenchmarkResult ? (
            <div className="space-y-2 pt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-400">Composite Score</span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {lastBenchmarkResult.score} <span className="text-xs text-slate-500">/ 1000</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500">CPU</span>
                  <p className="font-bold text-white font-mono">{lastBenchmarkResult.breakdown.cpu}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500">Disk</span>
                  <p className="font-bold text-white font-mono">{lastBenchmarkResult.breakdown.disk}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500">GPU</span>
                  <p className="font-bold text-white font-mono">{lastBenchmarkResult.breakdown.gpu}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-500 pt-3">
              <span>Benchmark not yet executed this session.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
