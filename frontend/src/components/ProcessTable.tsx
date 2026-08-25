import React, { useState } from 'react';
import { ProcessTickItem } from '../types/telemetry';
import { Shield, ShieldAlert, Cpu, HardDrive, ArrowUpDown, Search } from 'lucide-react';

interface ProcessTableProps {
  processes: ProcessTickItem[];
}

type SortField = 'cpu_percent' | 'ram_mb' | 'io_percent';

export const ProcessTable: React.FC<ProcessTableProps> = ({ processes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('cpu_percent');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const filtered = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pid.toString().includes(searchTerm)
  );

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortBy] ?? 0;
    const valB = b[sortBy] ?? 0;
    return sortDesc ? valB - valA : valA - valB;
  });

  return (
    <div className="glass-card rounded-2xl p-5 overflow-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-200 text-base flex items-center gap-2">
            <span>Top Active Processes</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300">
              {processes.length} tracked
            </span>
          </h3>
          <p className="text-xs text-slate-400">Live per-process CPU, RAM, and Disk I/O consumption</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search process or PID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800/80 text-slate-400 font-medium">
              <th className="pb-3 pl-2">Process</th>
              <th className="pb-3 text-right">PID</th>
              <th
                className="pb-3 text-right cursor-pointer hover:text-indigo-400 transition-colors"
                onClick={() => handleSort('cpu_percent')}
              >
                <div className="flex items-center justify-end gap-1">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>CPU %</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="pb-3 text-right cursor-pointer hover:text-indigo-400 transition-colors"
                onClick={() => handleSort('ram_mb')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>RAM (MB)</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="pb-3 text-right cursor-pointer hover:text-indigo-400 transition-colors"
                onClick={() => handleSort('io_percent')}
              >
                <div className="flex items-center justify-end gap-1">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>I/O %</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th className="pb-3 text-right pr-2">Elevation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 font-mono">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                  No matching processes found.
                </td>
              </tr>
            ) : (
              sorted.map((proc) => {
                const isCpuHigh = proc.cpu_percent > 15;
                const isRamHigh = proc.ram_mb > 500;

                return (
                  <tr
                    key={proc.pid}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Process Name */}
                    <td className="py-2.5 pl-2 font-sans font-medium text-slate-200 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-600 group-hover:bg-indigo-400 transition-colors" />
                      <span className="truncate max-w-[160px] sm:max-w-[220px]" title={proc.name}>
                        {proc.name}
                      </span>
                    </td>

                    {/* PID */}
                    <td className="py-2.5 text-right text-slate-400">
                      {proc.pid}
                    </td>

                    {/* CPU % */}
                    <td className="py-2.5 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          isCpuHigh
                            ? 'bg-rose-950/80 text-rose-300 font-bold border border-rose-800/50'
                            : 'text-slate-200'
                        }`}
                      >
                        {proc.cpu_percent.toFixed(1)}%
                      </span>
                    </td>

                    {/* RAM MB */}
                    <td className="py-2.5 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          isRamHigh
                            ? 'bg-amber-950/80 text-amber-300 font-bold border border-amber-800/50'
                            : 'text-slate-200'
                        }`}
                      >
                        {proc.ram_mb.toFixed(1)} MB
                      </span>
                    </td>

                    {/* IO % */}
                    <td className="py-2.5 text-right text-slate-300">
                      {proc.io_percent !== undefined ? `${proc.io_percent.toFixed(1)}%` : '--'}
                    </td>

                    {/* Elevation */}
                    <td className="py-2.5 text-right pr-2">
                      {proc.is_elevated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-400 border border-amber-800/60">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
                          <Shield className="w-3 h-3" />
                          <span>User</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
