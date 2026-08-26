import React from 'react';
import { ConnectionStatus } from '../types/telemetry';
import { Activity, Stethoscope, Clock, FileText, Gauge, RefreshCw, AlertCircle } from 'lucide-react';

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
  const getStatusIndicator = () => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="font-medium text-emerald-900">Agent Connected</span>
            {latencyMs !== null && (
              <span className="text-[11px] font-mono text-emerald-700/80 border-l border-emerald-200 pl-1.5 ml-0.5">
                {latencyMs}ms
              </span>
            )}
          </div>
        );
      case 'reconnecting':
      case 'connecting':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-50/80 border border-amber-200/80 text-amber-800 text-xs">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600 flex-shrink-0" />
            <span className="font-medium text-amber-900">Connecting...</span>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <button
            onClick={onReconnect}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 transition-colors text-xs font-medium"
          >
            <AlertCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />
            <span>Disconnected (Retry)</span>
          </button>
        );
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Stethoscope className="w-3.5 h-3.5" /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'report', label: 'Health Report', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'benchmark', label: 'Benchmark', icon: <Gauge className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 tracking-tight">CoreSight</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                1.0
              </span>
            </div>
            <span className="hidden sm:inline text-slate-300 text-xs">|</span>
            <span className="hidden sm:inline text-xs text-slate-500">Hardware Diagnostics &amp; Telemetry</span>
          </div>

          {/* Segmented Desktop Navigation */}
          <nav className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-[6px] text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/70 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status */}
          <div className="flex items-center">
            {getStatusIndicator()}
          </div>
        </div>
      </div>
    </header>
  );
};
