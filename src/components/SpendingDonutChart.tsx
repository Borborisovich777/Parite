import React, { useMemo } from 'react';
import { Currency } from '../types';
import { formatMoney } from '../lib/exchangeRates';

export interface SpendingDonutSlice {
  label: string;
  amount: number;
}

interface SpendingDonutChartProps {
  slices: SpendingDonutSlice[];
  currency: Currency;
  emptyLabel: string;
}

const SLICE_COLORS = [
  '#818cf8',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#38bdf8',
  '#a78bfa',
];

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({
  slices,
  currency,
  emptyLabel,
}) => {
  const chartSlices = useMemo(
    () => slices
      .map(slice => ({
        ...slice,
        amount: Number.isFinite(slice.amount) && slice.amount > 0 ? Math.round(slice.amount * 100) / 100 : 0,
      }))
      .filter(slice => slice.amount > 0),
    [slices]
  );
  const total = chartSlices.reduce((sum, slice) => sum + slice.amount, 0);

  if (total <= 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-[#1a1d23] p-5 text-center">
        <div className="mx-auto h-28 w-28 rounded-full border-[18px] border-slate-800/80 bg-[#121418]" />
        <p className="mt-4 text-xs font-semibold text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  let cursor = 0;
  const gradientStops = chartSlices.map((slice, index) => {
    const start = cursor;
    const percent = slice.amount / total * 100;
    cursor += percent;
    const color = SLICE_COLORS[index % SLICE_COLORS.length];
    return `${color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  const background = `conic-gradient(${gradientStops.join(', ')})`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#1a1d23] p-4">
      <div className="flex items-center gap-4">
        <div
          className="relative h-28 w-28 shrink-0 rounded-full"
          style={{ background }}
          aria-hidden="true"
        >
          <div className="absolute inset-[22px] rounded-full bg-[#1a1d23] border border-slate-800 flex items-center justify-center">
            <span className="text-[10px] font-mono font-bold text-slate-300">
              {formatMoney(total, currency)}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-2">
          {chartSlices.map((slice, index) => {
            const percent = total > 0 ? slice.amount / total * 100 : 0;
            return (
              <div key={`${slice.label}-${index}`} className="flex items-start gap-2">
                <span
                  className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-100">{slice.label}</p>
                  <p className="text-[10px] font-mono text-slate-500">
                    {formatMoney(slice.amount, currency)} · {percent.toFixed(0)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
