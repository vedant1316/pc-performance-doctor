import React from 'react';
import { MetricsTick, ConnectionStatus, DiagnosisResult } from '../types/telemetry';
import { MetricGauge } from '../components/MetricGauge';
import { ProcessTable } from '../components/ProcessTable';
import { DiagnosticActionCard } from '../components/DiagnosticActionCard';
import { Cpu, MemoryStick as Memory, HardDrive, Gamepad2, Network } from 'lucide-react';

interface DashboardProps {
  status: ConnectionStatus;
  latestTick: MetricsTick | null;
  history: MetricsTick[];
  lastDiagnosis: DiagnosisResult | null;
  onDiagnose: () => void;
  onViewDiagnosis?: () => void;
}

function formatBytes(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s';
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export const Dashboard: React.FC<DashboardProps> = ({
  status,
  latestTick,
  history,
  lastDiagnosis,
  onDiagnose,
  onViewDiagnosis = () => {},
}) => {
  // Sparkline history extraction
  const cpuHistory = history.map((t) => ({ value: t.cpu_percent }));
  const ramHistory = history.map((t) => ({ value: t.ram_percent }));
  const diskHistory = history.map((t) => ({ value: t.disk_percent_busy }));
  const netRecvHistory = history.map((t) => ({ value: t.net_recv_bps / 1024 })); // KB/s

  // Telemetry metrics
  const cpuPercent = latestTick?.cpu_percent ?? 0;
  const ramPercent = latestTick?.ram_percent ?? 0;
  const diskBusy = latestTick?.disk_percent_busy ?? 0;
  const gpuPercent = latestTick?.gpu_percent ?? null;
  const netSent = latestTick?.net_sent_bps ?? 0;
  const netRecv = latestTick?.net_recv_bps ?? 0;

  return (
    <div className="space-y-4">
      {/* Primary Action / Diagnostic Card */}
      <DiagnosticActionCard
        isConnected={status === 'connected'}
        isDiagnosing={false}
        onDiagnose={onDiagnose}
        lastDiagnosis={lastDiagnosis}
        onViewDiagnosis={onViewDiagnosis}
      />

      {/* Primary Metrics 5-Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* 1. CPU Card */}
        <MetricGauge
          title="Processor"
          value={cpuPercent.toFixed(1)}
          percentage={cpuPercent}
          icon={<Cpu className="w-4 h-4" />}
          historyData={cpuHistory}
          statusText={cpuPercent > 85 ? 'High Load' : 'Normal'}
          badges={[
            {
              label: 'Temperature',
              value:
                latestTick?.cpu_temp_c !== null && latestTick?.cpu_temp_c !== undefined
                  ? `${latestTick.cpu_temp_c}°C`
                  : 'N/A',
            },
            {
              label: 'Clock Frequency',
              value: latestTick?.cpu_freq_mhz ? `${Math.round(latestTick.cpu_freq_mhz)} MHz` : '--',
            },
            {
              label: 'Logical Cores',
              value: latestTick?.per_core_percent ? `${latestTick.per_core_percent.length}` : '--',
            },
            {
              label: 'Max Process Load',
              value: latestTick?.top_process_cpu_percent ? `${latestTick.top_process_cpu_percent}%` : '--',
            },
          ]}
        />

        {/* 2. Memory (RAM) Card */}
        <MetricGauge
          title="Memory"
          value={ramPercent.toFixed(1)}
          percentage={ramPercent}
          icon={<Memory className="w-4 h-4" />}
          historyData={ramHistory}
          statusText={ramPercent > 85 ? 'Pressure' : 'Optimal'}
          badges={[
            {
              label: 'Available',
              value: latestTick?.ram_available_mb ? `${(latestTick.ram_available_mb / 1024).toFixed(1)} GB` : '--',
            },
            {
              label: 'Used / Total',
              value:
                latestTick?.ram_used_mb && latestTick?.ram_total_mb
                  ? `${(latestTick.ram_used_mb / 1024).toFixed(1)} / ${(latestTick.ram_total_mb / 1024).toFixed(1)} GB`
                  : '--',
            },
            {
              label: 'Paging File',
              value:
                latestTick?.pagefile_percent !== null && latestTick?.pagefile_percent !== undefined
                  ? `${latestTick.pagefile_percent}%`
                  : '--',
            },
            {
              label: 'Free Memory',
              value: latestTick?.ram_available_mb ? `${latestTick.ram_available_mb} MB` : '--',
            },
          ]}
        />

        {/* 3. Disk I/O Card */}
        <MetricGauge
          title="Storage Activity"
          value={diskBusy.toFixed(1)}
          percentage={diskBusy}
          icon={<HardDrive className="w-4 h-4" />}
          historyData={diskHistory}
          statusText={diskBusy > 80 ? 'Busy' : 'Idle'}
          badges={[
            {
              label: 'Read Speed',
              value: latestTick?.disk_read_bps !== undefined ? formatBytes(latestTick.disk_read_bps) : '--',
            },
            {
              label: 'Write Speed',
              value: latestTick?.disk_write_bps !== undefined ? formatBytes(latestTick.disk_write_bps) : '--',
            },
            {
              label: 'Max Process I/O',
              value: latestTick?.top_process_io_percent ? `${latestTick.top_process_io_percent}%` : '--',
            },
            {
              label: 'Active Queue',
              value: `${diskBusy.toFixed(0)}%`,
            },
          ]}
        />

        {/* 4. GPU Card */}
        <MetricGauge
          title="Graphics Adapter"
          subtitle={latestTick?.gpu_name || 'Display Adapter'}
          value={gpuPercent !== null ? gpuPercent.toFixed(1) : 'N/A'}
          percentage={gpuPercent}
          icon={<Gamepad2 className="w-4 h-4" />}
          statusText={gpuPercent !== null ? (gpuPercent > 80 ? 'High' : 'Normal') : 'Standby'}
          badges={[
            {
              label: 'Temperature',
              value:
                latestTick?.gpu_temp_c !== null && latestTick?.gpu_temp_c !== undefined
                  ? `${latestTick.gpu_temp_c}°C`
                  : 'N/A',
            },
            {
              label: 'VRAM Allocation',
              value:
                latestTick?.gpu_vram_percent !== null && latestTick?.gpu_vram_percent !== undefined
                  ? `${latestTick.gpu_vram_percent.toFixed(1)}%`
                  : 'N/A',
            },
            {
              label: 'Architecture',
              value: latestTick?.gpu_name ? latestTick.gpu_name.split(' ')[0] : 'Standard',
            },
            {
              label: 'Core Load',
              value: gpuPercent !== null ? `${gpuPercent.toFixed(0)}%` : '--',
            },
          ]}
        />

        {/* 5. Network Throughput Card */}
        <MetricGauge
          title="Network Interface"
          value={formatBytes(netRecv + netSent)}
          unit=""
          icon={<Network className="w-4 h-4" />}
          historyData={netRecvHistory}
          statusText="Active"
          badges={[
            {
              label: 'Download (In)',
              value: formatBytes(netRecv),
            },
            {
              label: 'Upload (Out)',
              value: formatBytes(netSent),
            },
            {
              label: 'Transmit Rate',
              value: `${Math.round(netSent / 8)} B/s`,
            },
            {
              label: 'Receive Rate',
              value: `${Math.round(netRecv / 8)} B/s`,
            },
          ]}
        />
      </div>

      {/* Per-Core Visualizer (if multi-core data available) */}
      {latestTick?.per_core_percent && latestTick.per_core_percent.length > 0 && (
        <div className="app-panel p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
              <span>Logical Core Utilization ({latestTick.per_core_percent.length} Cores)</span>
            </h4>
            <span className="text-[11px] text-slate-500 tabular-nums">
              Avg: {(latestTick.per_core_percent.reduce((a, b) => a + b, 0) / latestTick.per_core_percent.length).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
            {latestTick.per_core_percent.map((corePct, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 rounded p-1.5 flex flex-col justify-between">
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                  <span>C{idx}</span>
                  <span className="text-slate-700 font-medium tabular-nums">{corePct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      corePct > 80 ? 'bg-rose-500' : corePct > 50 ? 'bg-amber-500' : 'bg-slate-800'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, corePct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Section: Top Processes Table */}
      <ProcessTable processes={latestTick?.top_processes ?? []} />
    </div>
  );
};
