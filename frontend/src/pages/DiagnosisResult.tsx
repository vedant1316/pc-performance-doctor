import React from 'react';
import { Stethoscope, Sparkles, ArrowLeft } from 'lucide-react';
import { DiagnosisResult as DiagnosisResultType } from '../types/telemetry';

interface DiagnosisResultProps {
  diagnosis: DiagnosisResultType | null;
  onBackToDashboard: () => void;
}

export const DiagnosisResult: React.FC<DiagnosisResultProps> = ({
  diagnosis,
  onBackToDashboard,
}) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <button
        onClick={onBackToDashboard}
        className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Live Dashboard</span>
      </button>

      <div className="glass-card rounded-2xl p-6 border border-indigo-500/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">System Diagnostic Report</h2>
            <p className="text-xs text-slate-400">Deterministic Rule Engine Evaluation</p>
          </div>
        </div>

        {diagnosis ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-400">Diagnosis Label</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {diagnosis.diagnosis.label}
                </span>
              </div>
              <p className="text-sm text-slate-200">
                {diagnosis.explanation?.summary || 'Phase 2 Live Telemetry active.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-semibold text-slate-300">Ready for Phase 3 Diagnostic Engine</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Click &quot;Diagnose My PC&quot; on the Live Dashboard to trigger live rule evaluation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
