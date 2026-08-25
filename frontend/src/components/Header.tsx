import React from 'react';
import { ConnectionStatus } from '../types/telemetry';
import { Activity, Stethoscope, Clock, FileText, WifiOff, RefreshCw, Zap } from 'lucide-react';

interface HeaderProps {
  status: ConnectionStatus;
  latencyMs: number | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onReconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  latencyMs,
  activeTab,
  setActiveTab,
  onReconnect,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium">Live Agent Active</span>
            {latencyMs !== null && (
              <span className="text-[10px] font-mono text-emerald-400/80 border-l border-emerald-800/80 pl-2">
                {latencyMs}ms
              </span>
            )}
          </div>
        );
      case 'reconnecting':
      case 'connecting':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Connecting...</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <button
            onClick={onReconnect}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-300 hover:bg-rose-900/80 transition-colors text-xs"
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>Disconnected (Retry)</span>
          </button>
        );
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Live Dashboard', icon: <Activity className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Diagnosis', icon: <Stethoscope className="w-4 h-4" />, badge: 'Phase 3' },
    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" />, badge: 'Phase 4' },
    { id: 'report', label: 'Health Report', icon: <FileText className="w-4 h-4" />, badge: 'Phase 6' },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-0.5 flex items-center justify-center glow-indigo shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white tracking-tight">PC Performance Doctor</h1>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v0.2
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Deterministic Diagnostics + LLM Explanation</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && !isActive && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-500 border border-slate-700/50">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-3">
            {getStatusBadge()}
          </div>
        </div>
      </div>
    </header>
  );
};
