import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MetricGaugeProps {
  title: string;
  value: number | string | null;
  unit?: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'neutral';
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
  historyData = [],
  badges = [],
  percentage,
  statusText,
}) => {
  const numValue = percentage !== undefined && percentage !== null ? percentage : typeof value === 'number' ? value : 0;

  // Semantic status determination
  const isHigh = numValue >= 85;
  const isMedium = numValue >= 70 && numValue < 85;

  const getStatusBadge = () => {
    if (isHigh) {
      return (
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700">
          {statusText || 'High'}
        </span>
      );
    }
    if (isMedium) {
      return (
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
          {statusText || 'Elevated'}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
        {statusText || 'Normal'}
      </span>
    );
  };

  const barColor = isHigh ? '#e11d48' : isMedium ? '#d97706' : '#0f172a';
  const sparklineStroke = isHigh ? '#e11d48' : isMedium ? '#d97706' : '#64748b';

  return (
    <div className="app-panel p-4 flex flex-col justify-between">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">{icon}</span>
            <span className="font-medium text-xs text-slate-800">{title}</span>
          </div>
          {getStatusBadge()}
        </div>

        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 font-normal">{subtitle}</p>}

        {/* Value */}
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
            {value !== null && value !== undefined ? value : '--'}
          </span>
          {unit && <span className="text-xs font-normal text-slate-500">{unit}</span>}
        </div>

        {/* Minimal Progress Bar */}
        {percentage !== undefined && percentage !== null && (
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, percentage))}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        )}
      </div>

      {/* Sparkline History Area */}
      {historyData.length > 3 && (
        <div className="h-9 w-full my-2.5 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparklineStroke}
                strokeWidth={1.5}
                fillOpacity={0.08}
                fill={sparklineStroke}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Badges metadata grid */}
      {badges.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[11px]">
          {badges.map((b, idx) => (
            <div key={idx} className="flex flex-col bg-slate-50 px-2 py-1.5 rounded border border-slate-100 gap-0.5">
              <span className="text-slate-400 font-normal leading-none">{b.label}</span>
              <span className="text-slate-800 font-medium tabular-nums leading-tight">
                {b.value !== null && b.value !== undefined ? b.value : '--'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
