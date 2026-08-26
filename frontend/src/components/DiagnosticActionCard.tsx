import React from 'react';
import { DiagnosisResult } from '../types/telemetry';
import { Stethoscope, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

interface DiagnosticActionCardProps {
  onDiagnose: () => void;
  isDiagnosing?: boolean;
  isConnected: boolean;
  lastDiagnosis: DiagnosisResult | null;
  onViewDiagnosis?: () => void;
}

export const DiagnosticActionCard: React.FC<DiagnosticActionCardProps> = ({
  onDiagnose,
  isDiagnosing = false,
  isConnected,
  lastDiagnosis,
  onViewDiagnosis = () => {},
}) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Critical Issue
          </span>
        );
      case 'medium':
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Warning
          </span>
        );
      case 'low':
      case 'nominal':
      case 'none':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            System Healthy
          </span>
        );
    }
  };

  return (
    <div className="app-panel p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Info */}
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 flex-shrink-0 mt-0.5">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">System Diagnostics</h3>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Deterministic Rule Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl font-normal">
              Inspects live hardware telemetry against threshold rules to deterministically identify performance bottlenecks.
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastDiagnosis && (
            <button
              onClick={onViewDiagnosis}
              className="btn-secondary"
            >
              <span>View Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onDiagnose}
            disabled={!isConnected || isDiagnosing}
            className="btn-primary min-w-[140px]"
          >
            {isDiagnosing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Diagnose My PC</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Last Diagnosis Result Summary Banner */}
      {lastDiagnosis && lastDiagnosis.diagnosis && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 font-normal">Latest Evaluation:</span>
            <span className="font-semibold text-slate-900 capitalize">
              {lastDiagnosis.diagnosis.label.replace(/_/g, ' ')}
            </span>
            {getSeverityBadge(lastDiagnosis.diagnosis.severity)}
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <div>
              <span className="font-normal">Health Score: </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {lastDiagnosis.diagnosis.health_score} / 100
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
