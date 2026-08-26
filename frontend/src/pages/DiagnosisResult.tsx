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
  Sparkles,
  Wrench,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { DiagnosisResult as DiagnosisResultType, DiagnosisFix } from '../types/telemetry';

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
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 border border-rose-200 text-rose-700">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            Critical Severity
          </span>
        );
      case 'medium':
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 border border-amber-200 text-amber-700">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Warning
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 border border-blue-200 text-blue-700">
            <Activity className="w-3 h-3 text-blue-600" />
            Low Severity
          </span>
        );
      case 'none':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Healthy
          </span>
        );
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Easy
          </span>
        );
      case 'advanced':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Advanced
          </span>
        );
      case 'medium':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Medium
          </span>
        );
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'high':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            High Impact
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Low Impact
          </span>
        );
      case 'medium':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Medium Impact
          </span>
        );
    }
  };

  const getRuleIcon = (ruleId: string) => {
    switch (ruleId) {
      case 'thermal_throttling':
        return <Flame className="w-5 h-5 text-rose-600" />;
      case 'memory_pressure':
        return <Layers className="w-5 h-5 text-amber-600" />;
      case 'disk_bottleneck':
        return <HardDrive className="w-5 h-5 text-rose-600" />;
      case 'network_saturation':
        return <Network className="w-5 h-5 text-blue-600" />;
      case 'gpu_bound':
        return <Gamepad2 className="w-5 h-5 text-slate-700" />;
      case 'background_process_sprawl':
        return <Cpu className="w-5 h-5 text-amber-600" />;
      case 'nominal':
      default:
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    }
  };

  const healthScore = diagnosis?.diagnosis.health_score ?? 100;
  const isLlmSucceeded = Boolean(diagnosis?.llm_call_succeeded);
  const explanation = diagnosis?.explanation;
  const fixes: DiagnosisFix[] = explanation?.fixes || [];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="btn-secondary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </button>

        {onDiagnose && (
          <button
            onClick={handleRefresh}
            disabled={!isConnected || isRefreshing}
            className="btn-primary"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Re-evaluate System</span>
          </button>
        )}
      </div>

      {diagnosis ? (
        <div className="space-y-4">
          {/* Main Hero Card - Deterministic Rule Engine Result */}
          <div className="app-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              {/* Left Details */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getRuleIcon(diagnosis.diagnosis.rule_id)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Rule: {diagnosis.diagnosis.rule_id}
                    </span>
                    {getSeverityBadge(diagnosis.diagnosis.severity)}
                  </div>
                  <h1 className="text-xl font-semibold text-slate-900 tracking-tight capitalize">
                    {diagnosis.diagnosis.label.replace(/_/g, ' ')}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-xl font-normal">
                    Evaluated deterministically by local diagnostic engine from live hardware telemetry.
                  </p>
                </div>
              </div>

              {/* Right Health Score Gauge */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3.5 sm:px-5 flex-shrink-0">
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
                    Health Score
                  </span>
                  <span className="text-xs font-medium text-slate-700">
                    {healthScore >= 90 ? 'Optimal' : healthScore >= 75 ? 'Degraded' : 'Critical'}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white border border-slate-200 shadow-sm">
                  <span className="text-lg font-semibold text-slate-900 tabular-nums">
                    {healthScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostic Evaluation Summary */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Diagnostic Evaluation Summary
                </h3>
                <span className="text-[11px] text-slate-400 font-normal">
                  Authority: Deterministic Engine
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-md p-3 font-normal">
                {explanation?.summary ||
                  'All telemetry metrics evaluated against hardware threshold rules.'}
              </p>
            </div>
          </div>

          {/* AI Explanation Layer Section */}
          {isLlmSucceeded && explanation ? (
            <div className="space-y-4">
              {/* AI Deep Explanation & Root Cause Card */}
              <div className="app-panel p-5">
                <div className="flex items-center gap-2 mb-3.5">
                  <Sparkles className="w-4 h-4 text-slate-700" />
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                      AI Plain-English Analysis
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200/80 space-y-1">
                    <h4 className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                      Executive Summary
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-normal">
                      {explanation.summary}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200/80 space-y-1">
                    <h4 className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                      Root Cause Mechanism
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-normal">
                      {explanation.root_cause}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actionable Remediation Fixes */}
              <div className="app-panel p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                      Recommended Fixes
                    </h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-normal tabular-nums">
                    {fixes.length} {fixes.length === 1 ? 'Action' : 'Actions'}
                  </span>
                </div>

                {fixes.length > 0 ? (
                  <div className="space-y-2">
                    {fixes.map((fix, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-medium flex-shrink-0 mt-0.5 sm:mt-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-slate-800 font-medium">
                            {fix.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                          {getDifficultyBadge(fix.difficulty)}
                          {getImpactBadge(fix.impact)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-500 font-normal">
                    No immediate remediation actions required for this system state.
                  </div>
                )}

                {/* Expected Improvement Callout */}
                {explanation.expected_improvement && (
                  <div className="mt-3.5 p-3 rounded-md bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                    <TrendingUp className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                        Expected Improvement
                      </h5>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-normal">
                        {explanation.expected_improvement}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Fallback Alert Banner when AI explanation is unavailable */
            <div className="app-panel p-4 border-amber-200 bg-amber-50/50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-amber-900">
                    AI explanation unavailable — showing rules-engine diagnosis only.
                  </h4>
                  <p className="text-xs text-amber-700/90 leading-normal font-normal">
                    The deterministic rule engine calculated the verified diagnosis above. To enable AI-powered remediation writeups, configure your OpenAI-compatible API key (<code className="text-amber-800 font-mono">LLM_API_KEY</code>) in the agent environment.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contributing Processes Section */}
          <div className="app-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-600" />
                <span>Contributing Processes</span>
              </h3>
              <span className="text-xs text-slate-500 font-normal tabular-nums">
                {diagnosis.diagnosis.contributing_processes.length} Detected
              </span>
            </div>

            {diagnosis.diagnosis.contributing_processes &&
            diagnosis.diagnosis.contributing_processes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {diagnosis.diagnosis.contributing_processes.map((procName, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-200"
                  >
                    <span className="font-mono text-xs text-slate-800 truncate">{procName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-medium">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-normal">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  No high-impact offending processes detected. All running tasks are within normal operational limits.
                </span>
              </div>
            )}
          </div>

          {/* Architecture Guarantee Footer */}
          <div className="app-panel p-4 bg-slate-50">
            <div className="flex items-start gap-3">
              <Stethoscope className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-slate-800">
                  Deterministic Diagnostic Engine + AI Explanation Layer
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-normal font-normal">
                  The bottleneck, root cause, severity, and health score are calculated deterministically by local algorithms without an AI model. The AI layer translates this verified diagnosis into human-friendly remediation actions.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="app-panel p-12 text-center">
          <Stethoscope className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-80" />
          <h3 className="text-sm font-semibold text-slate-900">No Diagnostic Run Available</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto font-normal">
            Click &quot;Re-evaluate System&quot; above or &quot;Diagnose My PC&quot; on the Overview tab to run the deterministic rule engine.
          </p>
        </div>
      )}
    </div>
  );
};
