import React from 'react';
import { FileText, ShieldCheck } from 'lucide-react';

export const HealthReport: React.FC = () => {
  return (
    <div className="glass-card rounded-2xl p-8 max-w-4xl mx-auto text-center">
      <FileText className="w-10 h-10 text-cyan-400 mx-auto mb-3 opacity-70" />
      <h2 className="text-base font-bold text-white">System Health Report</h2>
      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
        Phase 6 summary view combining live health scores, bottleneck trends, and exportable diagnostics.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
        <span>Health Score Ready</span>
      </div>
    </div>
  );
};
