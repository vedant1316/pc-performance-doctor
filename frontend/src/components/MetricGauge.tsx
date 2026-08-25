import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MetricGaugeProps {
  title: string;
  value: number | string | null;
  unit?: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose';
  historyData?: { value: number }[];
  badges?: { label: string; value: string | number | null }[];
  percentage?: number | null;
  statusText?: string;
}

export const MetricGauge: React.FC<MetricGaugeProps> = ({
  title,
  value,
  unit = '%',
  subtitle,
  icon,
  color = 'indigo',
  historyData = [],
  badges = [],
  percentage,
  statusText,
}) => {
  const numValue = percentage !== undefined && percentage !== null ? percentage : typeof value === 'number' ? value : 0;

  // Determine dynamic severity color
  const getProgressColor = () => {
    if (color === 'emerald') return '#10b981';
    if (color === 'cyan') return '#06b6d4';
    if (color === 'amber') return '#f59e0b';
    if (color === 'rose') return '#f43f5e';
    if (numValue >= 85) return '#f43f5e';
    if (numValue >= 70) return '#f59e0b';
    return '#6366f1';
  };

  const activeColor = getProgressColor();

  // SVG Circular Gauge calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, numValue)) / 100) * circumference;

  return (
    <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
      {/* Background ambient glow */}
      <div
        className="absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-15 pointer-events-none"
        style={{ backgroundColor: activeColor }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60"
            style={{ color: activeColor }}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-200 tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 font-normal">{subtitle}</p>}
          </div>
        </div>

        {statusText && (
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
            {statusText}
          </span>
        )}
      </div>

      {/* Center Value & Circular Progress */}
      <div className="my-4 flex items-center justify-between gap-4 z-10">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {value !== null && value !== undefined ? value : '--'}
            </span>
            {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {percentage !== undefined && percentage !== null ? `${percentage.toFixed(1)}% capacity` : 'Live telemetry'}
          </p>
        </div>

        {/* Circular Gauge */}
        <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 96 96">
            {/* Background Track */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="text-slate-800/90"
              strokeWidth="7"
              stroke="currentColor"
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke={activeColor}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-[11px] font-mono font-bold text-slate-200">
              {percentage !== undefined && percentage !== null
                ? `${Math.round(percentage)}%`
                : typeof value === 'number'
                ? `${Math.round(value)}%`
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Sparkline History Area */}
      {historyData.length > 3 && (
        <div className="h-12 w-full -mb-2 mt-1 opacity-75">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={activeColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={activeColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${title})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Badges footer */}
      {badges.length > 0 && (
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs z-10">
          {badges.map((b, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-900/50 px-2 py-1 rounded-md">
              <span className="text-slate-400 truncate">{b.label}</span>
              <span className="font-mono text-slate-200 font-medium ml-1 truncate">
                {b.value !== null && b.value !== undefined ? b.value : '--'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
