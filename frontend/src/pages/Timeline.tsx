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
  Sparkles,
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
      startIso = new Date(now.getTime() - 6 * 60 * 1000).toISOString();
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

  const stats = useMemo(() => {
    if (snapshots.length === 0) {
      return { avgCpu: '0', maxCpu: '0', avgRam: '0', maxRam: '0', maxDisk: '0' };
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
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            High
          </span>
        );
      case 'medium':
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Medium
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Activity className="w-3 h-3 text-blue-600" />
            Low
          </span>
        );
      case 'none':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Nominal
          </span>
        );
    }
  };

  const getRuleIcon = (ruleId: string) => {
    switch (ruleId) {
      case 'thermal_throttling':
        return <Flame className="w-4 h-4 text-rose-600" />;
      case 'memory_pressure':
        return <Layers className="w-4 h-4 text-amber-600" />;
      case 'disk_bottleneck':
        return <HardDrive className="w-4 h-4 text-rose-600" />;
      case 'network_saturation':
        return <Network className="w-4 h-4 text-blue-600" />;
      case 'gpu_bound':
        return <Gamepad2 className="w-4 h-4 text-slate-700" />;
      case 'background_process_sprawl':
        return <Cpu className="w-4 h-4 text-amber-600" />;
      case 'nominal':
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header & Query Controls */}
      <div className="app-panel p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Historical Performance Timeline
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                SQLite
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Query historical telemetry and deterministic diagnoses persisted in local database (<code className="text-slate-700 font-mono">performance.db</code>).
            </p>
          </div>

          {/* Time Range Preset Controls */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['15m', '1h', '6h', '24h', 'all'] as TimeRangePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-all ${
                  selectedPreset === preset
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {preset === '15m'
                  ? '15m'
                  : preset === '1h'
                  ? '1h'
                  : preset === '6h'
                  ? '6h'
                  : preset === '24h'
                  ? '24h'
                  : 'All History'}
              </button>
            ))}

            <button
              onClick={() => executeQuery(selectedPreset)}
              disabled={!isConnected || isRefreshing}
              title="Refresh Timeline Data"
              className="p-1 rounded-[6px] text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all disabled:opacity-50 ml-0.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Custom Range Filter */}
        <form
          onSubmit={handleCustomSearch}
          className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500"
        >
          <span className="text-[11px] text-slate-400 font-medium">Custom ISO Range:</span>
          <input
            type="text"
            placeholder="Start ISO (e.g. 2026-08-25T14:00:00Z)"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 font-mono text-[11px] w-56"
          />
          <input
            type="text"
            placeholder="End ISO (e.g. 2026-08-25T15:00:00Z)"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 font-mono text-[11px] w-56"
          />
          <button
            type="submit"
            className="btn-secondary py-1 px-2.5 text-xs"
          >
            <Search className="w-3 h-3" />
            <span>Apply</span>
          </button>
        </form>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="app-panel p-3">
          <span className="text-[11px] text-slate-500 font-medium block">Snapshots</span>
          <span className="text-base font-semibold text-slate-900 tabular-nums">{snapshots.length}</span>
        </div>
        <div className="app-panel p-3">
          <span className="text-[11px] text-slate-500 font-medium block">Avg CPU / Peak</span>
          <span className="text-base font-semibold text-slate-900 tabular-nums">
            {stats.avgCpu}% <span className="text-xs text-slate-400 font-normal">/ {stats.maxCpu}%</span>
          </span>
        </div>
        <div className="app-panel p-3">
          <span className="text-[11px] text-slate-500 font-medium block">Avg RAM / Peak</span>
          <span className="text-base font-semibold text-slate-900 tabular-nums">
            {stats.avgRam}% <span className="text-xs text-slate-400 font-normal">/ {stats.maxRam}%</span>
          </span>
        </div>
        <div className="app-panel p-3">
          <span className="text-[11px] text-slate-500 font-medium block">Max Disk Active</span>
          <span className="text-base font-semibold text-slate-900 tabular-nums">{stats.maxDisk}%</span>
        </div>
        <div className="app-panel p-3">
          <span className="text-[11px] text-slate-500 font-medium block">Diagnoses</span>
          <span className="text-base font-semibold text-slate-900 tabular-nums">{diagnoses.length}</span>
        </div>
      </div>

      {/* Main Historical Chart Card */}
      <div className="app-panel p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-600" />
              <span>Historical Metrics Telemetry</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Continuous hardware time-series recorded per polling tick
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveMetricTab('system')}
              className={`px-2.5 py-1 rounded-[6px] font-medium transition-all ${
                activeMetricTab === 'system'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CPU &amp; RAM &amp; GPU
            </button>
            <button
              onClick={() => setActiveMetricTab('io')}
              className={`px-2.5 py-1 rounded-[6px] font-medium transition-all ${
                activeMetricTab === 'io'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Disk &amp; Network I/O
            </button>
          </div>
        </div>

        {snapshots.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeMetricTab === 'system' ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="timeFormatted"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} unit="%" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '6px',
                      fontSize: '11px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    }}
                    labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU Utilization (%)"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    fillOpacity={0.06}
                    fill="#0f172a"
                  />
                  <Area
                    type="monotone"
                    dataKey="ram"
                    name="RAM Usage (%)"
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    fillOpacity={0.06}
                    fill="#2563eb"
                  />
                  <Area
                    type="monotone"
                    dataKey="gpu"
                    name="GPU Usage (%)"
                    stroke="#16a34a"
                    strokeWidth={1.5}
                    fillOpacity={0.06}
                    fill="#16a34a"
                  />
                </AreaChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="timeFormatted"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="disk"
                    name="Disk Busy (%)"
                    stroke="#d97706"
                    strokeWidth={1.5}
                    fillOpacity={0.06}
                    fill="#d97706"
                  />
                  <Area
                    type="monotone"
                    dataKey="netRecvKB"
                    name="Net Recv (KB/s)"
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    fillOpacity={0.06}
                    fill="#2563eb"
                  />
                  <Area
                    type="monotone"
                    dataKey="netSentKB"
                    name="Net Sent (KB/s)"
                    stroke="#7c3aed"
                    strokeWidth={1.5}
                    fillOpacity={0.06}
                    fill="#7c3aed"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-md border border-slate-200">
            <Database className="w-8 h-8 text-slate-400 mb-2 opacity-60" />
            <h4 className="text-xs font-semibold text-slate-700">No Historical Snapshots in Selected Range</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm font-normal">
              Keep the application open while the background polling loop writes ticks to <code className="text-slate-700 font-mono">performance.db</code>.
            </p>
          </div>
        )}
      </div>

      {/* Historical Diagnoses Section */}
      <div className="app-panel p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
              Historical Diagnoses Log
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-normal tabular-nums">
            {diagnoses.length} Events in Range
          </span>
        </div>

        {diagnoses.length > 0 ? (
          <div className="space-y-2">
            {diagnoses.map((diag) => (
              <div
                key={diag.id}
                className="p-3.5 rounded-md bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getRuleIcon(diag.rule_id)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-900 capitalize">
                        {diag.label.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                        Rule: {diag.rule_id}
                      </span>
                      {getSeverityBadge(diag.severity)}
                      {diag.llm_call_succeeded && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI Explained
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-normal">
                      {diag.llm_summary || `Rule engine detected bottleneck: ${diag.label}`}
                    </p>
                    {diag.llm_fixes && diag.llm_fixes.length > 0 && (
                      <div className="text-[11px] text-slate-500 mt-1 font-sans">
                        <span className="text-slate-700 font-medium">{diag.llm_fixes.length} fixes recommended: </span>
                        {diag.llm_fixes.map((f) => f.action).join(' • ')}
                      </div>
                    )}
                    {diag.contributing_processes && diag.contributing_processes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">Processes:</span>
                        {diag.contributing_processes.map((proc, pIdx) => (
                          <span
                            key={pIdx}
                            className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200"
                          >
                            {proc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {formatTime(diag.timestamp)}
                  </span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-400 font-normal">Score:</span>
                    <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-900 font-semibold tabular-nums">
                      {diag.health_score}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-50 rounded-md border border-slate-200">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
            <h4 className="text-xs font-semibold text-slate-700">No Diagnostic Events Recorded in Range</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
              Trigger &quot;Diagnose My PC&quot; on the Overview tab to record a timestamped diagnosis snapshot into SQLite.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
