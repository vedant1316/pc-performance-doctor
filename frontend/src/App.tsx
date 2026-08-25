import React, { useState } from 'react';
import { useAgentSocket } from './ws/useAgentSocket';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { DiagnosisResult } from './pages/DiagnosisResult';
import { Timeline } from './pages/Timeline';
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
    sendMessage,
    reconnect,
  } = useAgentSocket();

  const handleDiagnose = () => {
    sendMessage(createDiagnoseRequest());
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100 font-sans">
      {/* Top Navbar */}
      <Header
        status={status}
        latencyMs={latencyMs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReconnect={reconnect}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            status={status}
            latestTick={latestTick}
            history={history}
            lastDiagnosis={lastDiagnosis}
            onDiagnose={handleDiagnose}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosisResult
            diagnosis={lastDiagnosis}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'timeline' && <Timeline />}

        {activeTab === 'report' && <HealthReport />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PC Performance Doctor • Phase 2 Live Telemetry</span>
          <span className="font-mono text-[11px] text-slate-600">
            WebSocket: ws://127.0.0.1:8765
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
