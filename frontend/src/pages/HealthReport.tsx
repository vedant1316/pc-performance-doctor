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
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (healthScore >= 70) {
      return {
        label: 'Moderate Impact',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: 'Critical Bottleneck',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  };

  const scoreBadge = getScoreBadge();
  const snapshotCount = lastTimelineResult?.snapshots?.length ?? 0;
  const diagnosisCount = lastTimelineResult?.diagnoses?.length ?? 0;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header & Export Actions */}
      <div className="app-panel p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 flex-shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 tracking-tight">System Health Report</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                  PDF Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl font-normal">
                Comprehensive performance diagnostic combining real telemetry, deterministic reasoning, and AI remediation.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onDiagnose}
              disabled={!isConnected}
              className="btn-secondary"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Re-Diagnose</span>
            </button>

            <button
              onClick={onExportPdf}
              disabled={!isConnected || isExportingPdf}
              className="btn-primary"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Health Score & Status Hero */}
      <div className="app-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Overall PC Health Evaluation
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${scoreBadge.badgeClass}`}>
                {scoreBadge.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold text-slate-900 tracking-tight tabular-nums">
                {healthScore}
              </span>
              <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 font-normal">
              <span>Evaluated Rule: <code className="text-slate-800 font-mono font-medium">{label}</code></span>
            </div>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3.5 rounded-md border border-slate-200 text-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 font-normal">CPU Load</span>
              <p className="font-semibold text-slate-900 tabular-nums">
                {latestTick ? `${latestTick.cpu_percent.toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 font-normal">RAM Used</span>
              <p className="font-semibold text-slate-900 tabular-nums">
                {latestTick ? `${latestTick.ram_percent.toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 font-normal">Disk Busy</span>
              <p className="font-semibold text-slate-900 tabular-nums">
                {latestTick ? `${latestTick.disk_percent_busy.toFixed(1)}%` : '--'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 font-normal">Severity</span>
              <p className={`font-semibold uppercase ${
                severity === 'high' ? 'text-rose-700' : severity === 'medium' ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {severity}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Component Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU */}
        <div className="app-panel p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
              <span>Processor</span>
            </div>
            <span className="font-semibold text-slate-900 tabular-nums">{latestTick?.cpu_percent.toFixed(1) ?? '--'}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-800 rounded-full"
              style={{ width: `${latestTick?.cpu_percent ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Temp: {latestTick?.cpu_temp_c ? `${latestTick.cpu_temp_c.toFixed(1)}°C` : 'N/A'}</span>
            <span>{latestTick?.per_core_percent?.length ?? '--'} Cores</span>
          </div>
        </div>

        {/* RAM */}
        <div className="app-panel p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Memory</span>
            </div>
            <span className="font-semibold text-slate-900 tabular-nums">{latestTick?.ram_percent.toFixed(1) ?? '--'}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-800 rounded-full"
              style={{ width: `${latestTick?.ram_percent ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Avail: {latestTick ? `${(latestTick.ram_available_mb / 1024).toFixed(1)} GB` : '--'}</span>
            <span>Swap: {latestTick?.pagefile_percent ? `${latestTick.pagefile_percent.toFixed(0)}%` : '0%'}</span>
          </div>
        </div>

        {/* Storage */}
        <div className="app-panel p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>Storage I/O</span>
            </div>
            <span className="font-semibold text-slate-900 tabular-nums">{latestTick?.disk_percent_busy.toFixed(1) ?? '--'}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-800 rounded-full"
              style={{ width: `${latestTick?.disk_percent_busy ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>R: {latestTick?.disk_read_bps ? `${(latestTick.disk_read_bps / 1048576).toFixed(1)} MB/s` : '0 MB/s'}</span>
            <span>W: {latestTick?.disk_write_bps ? `${(latestTick.disk_write_bps / 1048576).toFixed(1)} MB/s` : '0 MB/s'}</span>
          </div>
        </div>

        {/* GPU */}
        <div className="app-panel p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-medium">
              <Tv className="w-3.5 h-3.5 text-slate-500" />
              <span>GPU Graphics</span>
            </div>
            <span className="font-semibold text-slate-900 tabular-nums">{latestTick?.gpu_percent ? `${latestTick.gpu_percent.toFixed(1)}%` : 'N/A'}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-800 rounded-full"
              style={{ width: `${latestTick?.gpu_percent ?? 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Temp: {latestTick?.gpu_temp_c ? `${latestTick.gpu_temp_c.toFixed(0)}°C` : 'N/A'}</span>
            <span className="truncate max-w-[90px]">{latestTick?.gpu_name ?? 'Display'}</span>
          </div>
        </div>
      </div>

      {/* Deterministic Reasoning Findings */}
      <div className="app-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Deterministic Rules Engine Diagnosis
            </h3>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
            Primary Authority
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-normal">Diagnostic Rule ID</span>
            <p className="font-mono font-medium text-slate-900 mt-0.5">{diagnosis?.rule_id ?? 'nominal'}</p>
          </div>
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-normal">Severity Classification</span>
            <p className={`font-semibold uppercase mt-0.5 ${
              severity === 'high' ? 'text-rose-700' : severity === 'medium' ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {severity}
            </p>
          </div>
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-normal">Contributing Processes</span>
            <p className="font-mono text-slate-800 mt-0.5 truncate">
              {diagnosis?.contributing_processes?.length
                ? diagnosis.contributing_processes.join(', ')
                : 'None (Nominal distribution)'}
            </p>
          </div>
        </div>
      </div>

      {/* AI Explanation & Ranked Remediation Plan */}
      <div className="app-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              AI Plain-English Explanation &amp; Action Plan
            </h3>
          </div>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            llmSucceeded
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {llmSucceeded ? 'AI Enhanced' : 'Rules-Engine Fallback'}
          </span>
        </div>

        {explanation ? (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-700 font-semibold">Executive Summary</span>
              <p className="text-slate-700 leading-relaxed font-normal">{explanation.summary}</p>
            </div>

            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-700 font-semibold">Underlying Root Cause</span>
              <p className="text-slate-700 leading-relaxed font-normal">{explanation.root_cause}</p>
            </div>

            {explanation.fixes && explanation.fixes.length > 0 && (
              <div className="space-y-2">
                <span className="text-slate-700 font-semibold">Ranked Remediation Steps</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {explanation.fixes.map((fix, idx) => (
                    <div key={idx} className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5 tabular-nums">
                        {idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-slate-800 font-medium">{fix.action}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>Difficulty: <span className="text-slate-700 capitalize">{fix.difficulty}</span></span>
                          <span>&bull;</span>
                          <span>Impact: <span className="text-slate-700 capitalize font-medium">{fix.impact}</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {explanation.expected_improvement && (
              <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 font-normal">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span><b>Expected Outcome: </b>{explanation.expected_improvement}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-700 font-medium">AI explanation unavailable</p>
              <p className="text-slate-500 mt-0.5 font-normal">
                Showing rules-engine diagnosis only. Click &quot;Re-Diagnose&quot; or configure an LLM API key in <code className="text-slate-700 font-mono">.env</code> to generate full AI writeups.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stability History & Synthetic Benchmark Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Timeline Stability Card */}
        <div className="app-panel p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>Historical Stability Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-normal">Persistent Samples</span>
              <p className="text-base font-semibold text-slate-900 mt-0.5 tabular-nums">{snapshotCount} ticks</p>
            </div>
            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] font-normal">Recorded Incidents</span>
              <p className="text-base font-semibold text-slate-900 mt-0.5 tabular-nums">{diagnosisCount} events</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-normal">
            Backed by local SQLite storage (<code className="text-slate-600 font-mono">performance.db</code>) with 14-day rolling retention.
          </p>
        </div>

        {/* Benchmark Card */}
        <div className="app-panel p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Gauge className="w-3.5 h-3.5 text-slate-600" />
            <span>Benchmark Score Snapshot</span>
          </div>
          {lastBenchmarkResult ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-500 font-normal">Composite Score</span>
                <span className="text-base font-semibold text-slate-900 tabular-nums">
                  {lastBenchmarkResult.score} <span className="text-xs text-slate-400 font-normal">/ 1000</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] pt-1">
                <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-normal">CPU</span>
                  <p className="font-semibold text-slate-900 tabular-nums">{lastBenchmarkResult.breakdown.cpu}</p>
                </div>
                <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-normal">Disk</span>
                  <p className="font-semibold text-slate-900 tabular-nums">{lastBenchmarkResult.breakdown.disk}</p>
                </div>
                <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-normal">GPU</span>
                  <p className="font-semibold text-slate-900 tabular-nums">{lastBenchmarkResult.breakdown.gpu}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 text-center text-slate-500 font-normal">
              <span>Benchmark not yet executed this session.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
