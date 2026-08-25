import React from 'react';
import { Clock, Database } from 'lucide-react';

export const Timeline: React.FC = () => {
  return (
    <div className="glass-card rounded-2xl p-8 max-w-4xl mx-auto text-center">
      <Clock className="w-10 h-10 text-indigo-400 mx-auto mb-3 opacity-70" />
      <h2 className="text-base font-bold text-white">Performance Timeline</h2>
      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
        Phase 4 SQLite Persistence will enable querying historical metrics snapshots
        and answering &quot;why was my PC slow at 2:30pm.&quot;
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
        <Database className="w-3.5 h-3.5 text-indigo-400" />
        <span>SQLite Schema Ready</span>
      </div>
    </div>
  );
};
