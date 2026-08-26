import React, { useState } from 'react';
import { useAgentSocket } from './ws/useAgentSocket';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { DiagnosisResult } from './pages/DiagnosisResult';
import { Timeline } from './pages/Timeline';
import { Benchmark } from './pages/Benchmark';
import { HealthReport } from './pages/HealthReport';
import { createDiagnoseRequest } from './lib/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const {
    status,
    latestTick,
    history,
    latencyMs,
    lastDiagnosis,
    lastTimelineResult,
    lastBenchmarkResult,
    isBenchmarking,
    isExportingPdf,
    sendMessage,
    queryTimeline,
    runBenchmark,
    exportPdf,
    reconnect,
  } = useAgentSocket();

  const handleDiagnose = () => {
    sendMessage(createDiagnoseRequest());
    setActiveTab('diagnostics');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Navbar */}
      <Header
        status={status}
        latencyMs={latencyMs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReconnect={reconnect}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'dashboard' && (
          <Dashboard
            status={status}
            latestTick={latestTick}
            history={history}
            lastDiagnosis={lastDiagnosis}
            onDiagnose={handleDiagnose}
            onViewDiagnosis={() => setActiveTab('diagnostics')}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosisResult
            diagnosis={lastDiagnosis}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onDiagnose={handleDiagnose}
            isConnected={status === 'connected'}
          />
        )}

        {activeTab === 'timeline' && (
          <Timeline
            timelineResult={lastTimelineResult}
            onQueryTimeline={queryTimeline}
            isConnected={status === 'connected'}
          />
        )}

        {activeTab === 'benchmark' && (
          <Benchmark
            benchmarkResult={lastBenchmarkResult}
            isBenchmarking={isBenchmarking}
            onRunBenchmark={runBenchmark}
            isConnected={status === 'connected'}
          />
        )}

        {activeTab === 'report' && (
          <HealthReport
            latestTick={latestTick}
            lastDiagnosis={lastDiagnosis}
            lastTimelineResult={lastTimelineResult}
            lastBenchmarkResult={lastBenchmarkResult}
            isExportingPdf={isExportingPdf}
            onExportPdf={exportPdf}
            onDiagnose={handleDiagnose}
            isConnected={status === 'connected'}
          />
        )}
      </main>

      {/* Clean Desktop App Footer */}
      <footer className="border-t border-slate-200 py-3 text-xs text-slate-500 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CoreSight • Hardware Diagnostics &amp; Telemetry</span>
          <span className="font-mono text-[11px] text-slate-400">
            Agent: ws://127.0.0.1:8765
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
