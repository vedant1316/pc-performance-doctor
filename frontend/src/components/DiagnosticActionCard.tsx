import React, { useState } from 'react';
import { Stethoscope, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { DiagnosisResult } from '../types/telemetry';

interface DiagnosticActionCardProps {
  onDiagnose: () => void;
  lastDiagnosis: DiagnosisResult | null;
  isConnected: boolean;
}

export const DiagnosticActionCard: React.FC<DiagnosticActionCardProps> = ({
  onDiagnose,
  lastDiagnosis,
  isConnected,
}) => {
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleClick = () => {
    setIsDiagnosing(true);
    onDiagnose();
    setTimeout(() => {
      setIsDiagnosing(false);
    }, 1200);
  };

  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden bg-gradient-to-r from-indigo-950/40 via-surface-card to-slate-900/60 border border-indigo-500/20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Info */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">CoreSight Diagnostic Engine</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                Rule Engine Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Inspects live hardware telemetry, evaluates bottleneck rules (<code className="text-indigo-300">rules.yaml</code>),
              and translates root causes into actionable plain-English fixes.
            </p>
          </div>
        </div>

        {/* Right CTA Button */}
        <button
          onClick={handleClick}
          disabled={!isConnected || isDiagnosing}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all flex-shrink-0 shadow-lg ${
            isConnected
              ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isDiagnosing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing System...</span>
            </>
          ) : (
            <>
              <Stethoscope className="w-4 h-4" />
              <span>Diagnose My PC</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Diagnosis Response Banner if triggered */}
      {lastDiagnosis && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-start gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-slate-200">Engine State: </span>
            <span className="text-slate-300">{lastDiagnosis.explanation?.summary || 'System telemetry streaming active.'}</span>
            <span className="ml-2 font-mono text-indigo-400">Health Score: {lastDiagnosis.diagnosis.health_score}/100</span>
          </div>
        </div>
      )}
    </div>
  );
};
