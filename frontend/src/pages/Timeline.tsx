import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Database,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  HardDrive,
  Network,
  ShieldAlert,
  Flame,
  Gamepad2,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TimelineResult,
  TimelineSnapshotRow,
  TimelineDiagnosisRow,
} from '../types/telemetry';

interface TimelineProps {
  timelineResult: TimelineResult | null;
  onQueryTimeline: (start?: string, end?: string) => void;
  isConnected: boolean;
}

type TimeRangePreset = '15m' | '1h' | '6h' | '24h' | 'all';

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoStr;
  }
}

export const Timeline: React.FC<TimelineProps> = ({
  timelineResult,
  onQueryTimeline,
  isConnected,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<TimeRangePreset>('1h');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [activeMetricTab, setActiveMetricTab] = useState<'system' | 'io'>('system');

  const executeQuery = (preset: TimeRangePreset) => {
    setIsRefreshing(true);
    const now = new Date();
    let startIso: string | undefined;
    const endIso = now.toISOString();

    if (preset === '15m') {
      startIso = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    } else if (preset === '1h') {
      startIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    } else if (preset === '6h') {
      startIso = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    } else if (preset === '24h') {
      startIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    } else if (preset === 'all') {
      startIso = undefined;
    }

    onQueryTimeline(startIso, preset === 'all' ? undefined : endIso);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handlePresetClick = (preset: TimeRangePreset) => {
    setSelectedPreset(preset);
    executeQuery(preset);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart || customEnd) {
      setIsRefreshing(true);
      onQueryTimeline(customStart || undefined, customEnd || undefined);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Initial query on mount or connection
  useEffect(() => {
    if (isConnected) {
      executeQuery(selectedPreset);
    }
  }, [isConnected]);

  const snapshots: TimelineSnapshotRow[] = useMemo(
    () => timelineResult?.snapshots || [],
    [timelineResult]
  );
  const diagnoses: TimelineDiagnosisRow[] = useMemo(
    () => timelineResult?.diagnoses || [],
    [timelineResult]
  );

  // Formatted chart data
  const chartData = useMemo(() => {
    return snapshots.map((s) => ({
      timestamp: s.timestamp,
      timeFormatted: formatTime(s.timestamp),
      cpu: Number(s.cpu_percent.toFixed(1)),
      ram: Number(s.ram_percent.toFixed(1)),
      disk: Number(s.disk_percent_busy.toFixed(1)),
      gpu: s.gpu_percent !== null && s.gpu_percent !== undefined ? Number(s.gpu_percent.toFixed(1)) : 0,
      netRecvKB: s.net_recv_bps ? Number((s.net_recv_bps / 1024).toFixed(1)) : 0,
      netSentKB: s.net_sent_bps ? Number((s.net_sent_bps / 1024).toFixed(1)) : 0,
    }));
  }, [snapshots]);

  // Aggregate statistics
  const stats = useMemo(() => {
    if (snapshots.length === 0) {
      return { avgCpu: 0, maxCpu: 0, avgRam: 0, maxRam: 0, maxDisk: 0 };
    }
    const cpuSum = snapshots.reduce((acc, s) => acc + s.cpu_percent, 0);
    const ramSum = snapshots.reduce((acc, s) => acc + s.ram_percent, 0);
    const maxCpu = Math.max(...snapshots.map((s) => s.cpu_percent));
    const maxRam = Math.max(...snapshots.map((s) => s.ram_percent));
    const maxDisk = Math.max(...snapshots.map((s) => s.disk_percent_busy));

    return {
      avgCpu: (cpuSum / snapshots.length).toFixed(1),
      maxCpu: maxCpu.toFixed(1),
      avgRam: (ramSum / snapshots.length).toFixed(1),
      maxRam: maxRam.toFixed(1),
      maxDisk: maxDisk.toFixed(1),
    };
  }, [snapshots]);

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            High
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Medium
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-400 border border-blue-800">
            <Activity className="w-3 h-3 text-blue-400" />
            Low
          </span>
        );
      case 'none':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Nominal
          </span>
        );
    }
  };

  const getRuleIcon = (ruleId: string) => {
    switch (ruleId) {
      case 'thermal_throttling':
        return <Flame className="w-4 h-4 text-rose-400" />;
      case 'memory_pressure':
        return <Layers className="w-4 h-4 text-amber-400" />;
      case 'disk_bottleneck':
        return <HardDrive className="w-4 h-4 text-rose-400" />;
      case 'network_saturation':
        return <Network className="w-4 h-4 text-cyan-400" />;
      case 'gpu_bound':
        return <Gamepad2 className="w-4 h-4 text-indigo-400" />;
      case 'background_process_sprawl':
        return <Cpu className="w-4 h-4 text-amber-400" />;
      case 'nominal':
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Query Controls */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 bg-gradient-to-r from-slate-900/90 via-surface-card to-slate-900/90">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Historical Performance Timeline
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                SQLite Persistence
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Query historical telemetry and deterministic diagnoses persisted in local database (<code className="text-indigo-300">performance.db</code>).
            </p>
          </div>

          {/* Time Range Preset Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
            {(['15m', '1h', '6h', '24h', 'all'] as TimeRangePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPreset === preset
                    ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {preset === '15m'
                  ? 'Last 15m'
                  : preset === '1h'
                  ? 'Last 1 Hour'
                  : preset === '6h'
                  ? 'Last 6 Hours'
                  : preset === '24h'
                  ? 'Last 24 Hours'
                  : 'All History'}
              </button>
            ))}

            <button
              onClick={() => executeQuery(selectedPreset)}
              disabled={!isConnected || isRefreshing}
              title="Refresh Timeline Data"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Custom Range Filter Collapse / Row */}
        <form
          onSubmit={handleCustomSearch}
          className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs text-slate-400"
        >
          <span className="font-mono text-[11px] text-slate-500">Custom ISO Range:</span>
          <input
            type="text"
            placeholder="Start ISO (e.g. 2026-08-25T14:00:00Z)"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px] w-64"
          />
          <input
            type="text"
            placeholder="End ISO (e.g. 2026-08-25T15:00:00Z)"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-[11px] w-64"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors font-medium text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Apply Query</span>
          </button>
        </form>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="glass-card rounded-xl p-3.5 border border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Snapshots in Range</span>
          <span className="text-lg font-bold font-mono text-indigo-400">{snapshots.length}</span>
        </div>
        <div className="glass-card rounded-xl p-3.5 border border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Avg CPU / Peak</span>
          <span className="text-lg font-bold font-mono text-cyan-400">
            {stats.avgCpu}% <span className="text-xs text-slate-500 font-normal">/ {stats.maxCpu}%</span>
          </span>
        </div>
        <div className="glass-card rounded-xl p-3.5 border border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Avg RAM / Peak</span>
          <span className="text-lg font-bold font-mono text-emerald-400">
            {stats.avgRam}% <span className="text-xs text-slate-500 font-normal">/ {stats.maxRam}%</span>
          </span>
        </div>
        <div className="glass-card rounded-xl p-3.5 border border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Max Disk Activity</span>
          <span className="text-lg font-bold font-mono text-amber-400">{stats.maxDisk}%</span>
        </div>
        <div className="glass-card rounded-xl p-3.5 border border-slate-800/80">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Diagnoses Logged</span>
          <span className="text-lg font-bold font-mono text-purple-400">{diagnoses.length}</span>
        </div>
      </div>

      {/* Main Historical Chart Card */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Historical Metrics Telemetry</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous hardware time-series recorded per polling tick
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveMetricTab('system')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeMetricTab === 'system'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CPU & RAM & GPU
            </button>
            <button
              onClick={() => setActiveMetricTab('io')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeMetricTab === 'io'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Disk & Network I/O
            </button>
          </div>
        </div>

        {snapshots.length > 0 ? (
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeMetricTab === 'system' ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis
                    dataKey="timeFormatted"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU Utilization (%)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cpuGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="ram"
                    name="RAM Usage (%)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#ramGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="gpu"
                    name="GPU Usage (%)"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#gpuGrad)"
                  />
                </AreaChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="diskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="netRecvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis
                    dataKey="timeFormatted"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="disk"
                    name="Disk Busy (%)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#diskGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="netRecvKB"
                    name="Net Recv (KB/s)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#netRecvGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="netSentKB"
                    name="Net Sent (KB/s)"
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    fillOpacity={0.2}
                    fill="#a855f7"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-900/50 rounded-xl border border-slate-800/80">
            <Database className="w-10 h-10 text-indigo-400 mb-2 opacity-50 animate-pulse" />
            <h4 className="text-sm font-semibold text-slate-300">No Historical Snapshots in Selected Range</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Keep the application open while the background polling loop writes ticks to <code className="text-indigo-400">performance.db</code>.
            </p>
          </div>
        )}
      </div>

      {/* Historical Diagnoses Section */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Historical Diagnoses Log</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {diagnoses.length} Events in Range
          </span>
        </div>

        {diagnoses.length > 0 ? (
          <div className="space-y-3">
            {diagnoses.map((diag) => (
              <div
                key={diag.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex-shrink-0 mt-0.5">
                    {getRuleIcon(diag.rule_id)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-white capitalize">
                        {diag.label.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        Rule: {diag.rule_id}
                      </span>
                      {getSeverityBadge(diag.severity)}
                    </div>
                    <p className="text-xs text-slate-300">
                      {diag.llm_summary || `Rule engine detected bottleneck: ${diag.label}`}
                    </p>
                    {diag.contributing_processes && diag.contributing_processes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-500 font-mono">Processes:</span>
                        {diag.contributing_processes.map((proc, pIdx) => (
                          <span
                            key={pIdx}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-900/50"
                          >
                            {proc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <span className="text-xs font-mono text-slate-400">
                    {formatTime(diag.timestamp)}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-indigo-400">
                    <span>Score:</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-white">
                      {diag.health_score}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800/60">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-slate-300">No Diagnostic Events Recorded in Range</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Trigger &quot;Diagnose My PC&quot; on the Live Dashboard to record a timestamped diagnosis snapshot into SQLite.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
