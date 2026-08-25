import React, { useState } from 'react';
import {
  Stethoscope,
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  RefreshCw,
  ShieldAlert,
  Flame,
  HardDrive,
  Network,
  Gamepad2,
  Check,
} from 'lucide-react';
import { DiagnosisResult as DiagnosisResultType } from '../types/telemetry';

interface DiagnosisResultProps {
  diagnosis: DiagnosisResultType | null;
  onBackToDashboard: () => void;
  onDiagnose?: () => void;
  isConnected?: boolean;
}

export const DiagnosisResult: React.FC<DiagnosisResultProps> = ({
  diagnosis,
  onBackToDashboard,
  onDiagnose,
  isConnected = true,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (onDiagnose) {
      setIsRefreshing(true);
      onDiagnose();
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800/80 shadow-sm shadow-rose-950/50">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            High Severity
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/80 shadow-sm shadow-amber-950/50">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Medium Severity
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-950/80 text-blue-400 border border-blue-800/80 shadow-sm shadow-blue-950/50">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            Low Severity
          </span>
        );
      case 'none':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 shadow-sm shadow-emerald-950/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Nominal / Healthy
          </span>
        );
    }
  };

  const getRuleIcon = (ruleId: string) => {
    switch (ruleId) {
      case 'thermal_throttling':
        return <Flame className="w-6 h-6 text-rose-400" />;
      case 'memory_pressure':
        return <Layers className="w-6 h-6 text-amber-400" />;
      case 'disk_bottleneck':
        return <HardDrive className="w-6 h-6 text-rose-400" />;
      case 'network_saturation':
        return <Network className="w-6 h-6 text-cyan-400" />;
      case 'gpu_bound':
        return <Gamepad2 className="w-6 h-6 text-indigo-400" />;
      case 'background_process_sprawl':
        return <Cpu className="w-6 h-6 text-amber-400" />;
      case 'nominal':
      default:
        return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
    }
  };

  const healthScore = diagnosis?.diagnosis.health_score ?? 100;
  const scoreColor =
    healthScore >= 90
      ? 'from-emerald-400 to-teal-400 text-emerald-400'
      : healthScore >= 75
      ? 'from-amber-400 to-yellow-400 text-amber-400'
      : 'from-rose-500 to-pink-500 text-rose-400';

  const scoreBorderColor =
    healthScore >= 90
      ? 'border-emerald-500/30'
      : healthScore >= 75
      ? 'border-amber-500/30'
      : 'border-rose-500/30';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Live Dashboard</span>
        </button>

        {onDiagnose && (
          <button
            onClick={handleRefresh}
            disabled={!isConnected || isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/80 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Re-evaluate System</span>
          </button>
        )}
      </div>

      {diagnosis ? (
        <div className="space-y-6">
          {/* Main Hero Card */}
          <div
            className={`glass-card rounded-2xl p-6 sm:p-8 border ${scoreBorderColor} relative overflow-hidden`}
          >
            {/* Background Glow */}
            <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              {/* Left Details */}
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner">
                  {getRuleIcon(diagnosis.diagnosis.rule_id)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/80">
                      Rule: {diagnosis.diagnosis.rule_id}
                    </span>
                    {getSeverityBadge(diagnosis.diagnosis.severity)}
                  </div>
                  <h1 className="text-2xl font-bold text-white tracking-tight capitalize">
                    {diagnosis.diagnosis.label.replace(/_/g, ' ')}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Evaluated deterministically from live hardware telemetry against{' '}
                    <code className="text-indigo-300">rules.yaml</code>.
                  </p>
                </div>
              </div>

              {/* Right Health Score Gauge */}
              <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:px-6 shadow-inner flex-shrink-0">
                <div className="text-right">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                    Health Score
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    {healthScore >= 90 ? 'Optimal' : healthScore >= 75 ? 'Degraded' : 'Critical'}
                  </span>
                </div>
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-950 border-2 border-slate-800">
                    <span
                      className={`text-xl font-black font-mono bg-gradient-to-br ${scoreColor} bg-clip-text text-transparent`}
                    >
                      {healthScore}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostic Summary Block */}
            <div className="mt-6 pt-6 border-t border-slate-800/80">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                Diagnostic Finding
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed font-sans bg-slate-900/60 border border-slate-800/60 rounded-xl p-4">
                {diagnosis.explanation?.summary ||
                  'All telemetry metrics evaluated against hardware threshold rules.'}
              </p>
            </div>
          </div>

          {/* Contributing Processes Section */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>Contributing Processes</span>
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {diagnosis.diagnosis.contributing_processes.length} Detected
              </span>
            </div>

            {diagnosis.diagnosis.contributing_processes &&
            diagnosis.diagnosis.contributing_processes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {diagnosis.diagnosis.contributing_processes.map((procName, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0 animate-pulse" />
                      <span className="font-mono text-xs text-slate-200 truncate">{procName}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  No high-impact offending processes detected. All running tasks are within normal operational limits.
                </span>
              </div>
            )}
          </div>

          {/* Rule Engine Architecture Badge */}
          <div className="glass-card rounded-2xl p-5 border border-indigo-950 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex-shrink-0 mt-0.5">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-200">
                    Deterministic Architecture Verification
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Phase 3 Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-normal">
                  The bottleneck, root cause, severity, and health score shown above were calculated directly by the local rule engine without an AI model. In Phase 5, an optional AI layer will translate this verified diagnosis into human-friendly remediation actions.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-800">
          <Stethoscope className="w-10 h-10 text-indigo-400 mx-auto mb-3 opacity-60 animate-bounce" />
          <h3 className="text-base font-bold text-white">No Diagnostic Run Available</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Click &quot;Re-evaluate System&quot; above or &quot;Diagnose My PC&quot; on the Live Dashboard to run the deterministic rule engine.
          </p>
        </div>
      )}
    </div>
  );
};
