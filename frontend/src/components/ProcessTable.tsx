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
    <div className="app-panel p-5 overflow-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 text-sm tracking-tight">Active Processes</h3>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 tabular-nums">
              {processes.length} tracked
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">Real-time resource utilization per application</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search process or PID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-medium bg-slate-50/50">
              <th className="py-2.5 pl-3">Process</th>
              <th className="py-2.5 text-right font-mono">PID</th>
              <th
                className="py-2.5 text-right cursor-pointer hover:text-slate-900 transition-colors"
                onClick={() => handleSort('cpu_percent')}
              >
                <div className="flex items-center justify-end gap-1">
                  <Cpu className="w-3 h-3 text-slate-400" />
                  <span>CPU %</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                className="py-2.5 text-right cursor-pointer hover:text-slate-900 transition-colors"
                onClick={() => handleSort('ram_mb')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>RAM (MB)</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                className="py-2.5 text-right cursor-pointer hover:text-slate-900 transition-colors"
                onClick={() => handleSort('io_percent')}
              >
                <div className="flex items-center justify-end gap-1">
                  <HardDrive className="w-3 h-3 text-slate-400" />
                  <span>I/O %</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th className="py-2.5 text-right pr-3">Privilege</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No matching active processes found.
                </td>
              </tr>
            ) : (
              sorted.map((proc) => {
                const isCpuHigh = proc.cpu_percent > 15;
                const isRamHigh = proc.ram_mb > 600;

                return (
                  <tr
                    key={proc.pid}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Process Name */}
                    <td className="py-2 pl-3 font-medium text-slate-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                      <span className="truncate max-w-[180px] sm:max-w-[240px]" title={proc.name}>
                        {proc.name}
                      </span>
                    </td>

                    {/* PID */}
                    <td className="py-2 text-right font-mono text-slate-400">
                      {proc.pid}
                    </td>

                    {/* CPU % */}
                    <td className="py-2 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] tabular-nums ${
                          isCpuHigh
                            ? 'bg-rose-50 text-rose-700 font-semibold border border-rose-200'
                            : 'text-slate-700 font-medium'
                        }`}
                      >
                        {proc.cpu_percent.toFixed(1)}%
                      </span>
                    </td>

                    {/* RAM MB */}
                    <td className="py-2 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] tabular-nums ${
                          isRamHigh
                            ? 'bg-amber-50 text-amber-700 font-semibold border border-amber-200'
                            : 'text-slate-700 font-medium'
                        }`}
                      >
                        {proc.ram_mb.toFixed(1)} MB
                      </span>
                    </td>

                    {/* IO % */}
                    <td className="py-2 text-right text-slate-600 tabular-nums font-medium">
                      {proc.io_percent !== undefined ? `${proc.io_percent.toFixed(1)}%` : '--'}
                    </td>

                    {/* Elevation */}
                    <td className="py-2 text-right pr-3">
                      {proc.is_elevated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                          <span>Admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-slate-400">
                          <Shield className="w-3 h-3 text-slate-400" />
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
