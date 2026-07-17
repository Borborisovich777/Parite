import React, { useMemo, useState } from 'react';
import { Currency } from '../types';
import { formatMoney } from '../lib/exchangeRates';
import { ExpenseIcon } from './ExpenseIcon';

export interface SpendingDonutSlice {
  id: string;
  label: string;
  amount: number;
  expenseCount: number;
  color: string;
  surface: string;
  visualId?: string;
}

interface SpendingDonutChartProps {
  slices: SpendingDonutSlice[];
  currency: Currency;
  emptyLabel: string;
  selectedSliceId?: string | null;
  onSelectSlice?: (sliceId: string | null) => void;
}

const DONUT_RADIUS = 44;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_SEGMENT_GAP = 2.4;

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({
  slices,
  currency,
  emptyLabel,
  selectedSliceId = null,
  onSelectSlice,
}) => {
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);
  const chartSlices = useMemo(
    () => slices
      .map(slice => ({
        ...slice,
        amount: Number.isFinite(slice.amount) && slice.amount > 0
          ? Math.round(slice.amount * 100) / 100
          : 0,
      }))
      .filter(slice => slice.amount > 0),
    [slices],
  );
  const total = chartSlices.reduce((sum, slice) => sum + slice.amount, 0);

  if (total <= 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white p-5 text-center">
        <div className="mx-auto h-28 w-28 rounded-full border-[18px] border-slate-800/80 bg-[#121418]" />
        <p className="mt-4 text-xs font-semibold text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  let runningOffset = 0;
  const segments = chartSlices.map(slice => {
    const percent = slice.amount / total * 100;
    const segmentLength = slice.amount / total * DONUT_CIRCUMFERENCE;
    const gapLength = chartSlices.length > 1
      ? Math.min(DONUT_SEGMENT_GAP, segmentLength * 0.22)
      : 0;
    const segment = {
      ...slice,
      percent,
      // Keep every dash inside its own angular allocation. A fixed minimum dash
      // can grow a tiny category into the next slice, while round line caps can
      // visually add almost a full stroke width across a narrow gap.
      dashLength: segmentLength - gapLength,
      dashOffset: -(runningOffset + gapLength / 2),
    };
    runningOffset += segmentLength;
    return segment;
  });
  const selectedSlice = segments.find(slice => slice.id === selectedSliceId) ?? null;
  const hoveredSlice = segments.find(slice => slice.id === hoveredSliceId) ?? null;
  const activeSlice = hoveredSlice ?? selectedSlice;
  const activeAmount = activeSlice?.amount ?? total;
  const activePercent = activeSlice?.percent ?? 100;

  const toggleSlice = (sliceId: string) => {
    onSelectSlice?.(selectedSliceId === sliceId ? null : sliceId);
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white p-4">
      <div className="flex min-w-0 flex-col gap-4 sm:grid sm:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)] sm:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-44 shrink-0">
          <svg
            viewBox="0 0 120 120"
            className="h-full w-full overflow-visible"
            aria-hidden="true"
          >
            <circle
              cx="60"
              cy="60"
              r={DONUT_RADIUS}
              fill="none"
              stroke="var(--color-surface-soft)"
              strokeWidth="18"
              aria-hidden="true"
            />
            {segments.map(slice => {
              const isSelected = selectedSliceId === slice.id;
              const isHovered = hoveredSliceId === slice.id;
              const hasActiveSlice = Boolean(selectedSliceId || hoveredSliceId);

              const dashArray = `${slice.dashLength} ${Math.max(DONUT_CIRCUMFERENCE - slice.dashLength, 0.001)}`;

              return (
                <g key={slice.id}>
                  <circle
                    cx="60"
                    cy="60"
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isSelected || isHovered ? 20 : 18}
                    strokeDasharray={dashArray}
                    strokeDashoffset={slice.dashOffset}
                    strokeLinecap="butt"
                    transform="rotate(-90 60 60)"
                    opacity={hasActiveSlice && !isSelected && !isHovered ? 0.34 : 1}
                    className="transition-[opacity,stroke-width,filter] duration-150"
                    style={{
                      filter: isSelected || isHovered ? `drop-shadow(0 3px 5px ${slice.color}55)` : undefined,
                      pointerEvents: 'none',
                    }}
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="32"
                    strokeDasharray={dashArray}
                    strokeDashoffset={slice.dashOffset}
                    strokeLinecap="butt"
                    transform="rotate(-90 60 60)"
                    className="cursor-pointer"
                    style={{ pointerEvents: 'stroke' }}
                    onClick={() => toggleSlice(slice.id)}
                    onMouseEnter={() => setHoveredSliceId(slice.id)}
                    onMouseLeave={() => setHoveredSliceId(null)}
                  />
                </g>
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-[24%] flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-white px-1.5 text-center shadow-sm">
            <span className="block w-[92%] break-words text-[clamp(7px,2.1vw,9px)] font-bold uppercase leading-[1.05] tracking-[0.06em] text-[var(--color-muted)]">
              {activeSlice?.label ?? 'All categories'}
            </span>
            <span className="mt-1 block w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[clamp(9px,2.7vw,11px)] font-bold leading-tight text-[var(--color-text)]">
              {formatMoney(activeAmount, currency)}
            </span>
            <span className="mt-0.5 block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(8px,2.3vw,9px)] font-bold leading-tight text-[var(--color-muted)]">
              {activePercent.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2">
          {segments.map(slice => {
            const isSelected = selectedSliceId === slice.id;
            const isHovered = hoveredSliceId === slice.id;

            return (
              <button
                key={slice.id}
                type="button"
                onClick={() => toggleSlice(slice.id)}
                onMouseEnter={() => setHoveredSliceId(slice.id)}
                onMouseLeave={() => setHoveredSliceId(null)}
                onFocus={() => setHoveredSliceId(slice.id)}
                onBlur={() => setHoveredSliceId(null)}
                aria-pressed={isSelected}
                className="min-h-14 min-w-0 cursor-pointer rounded-2xl border px-2.5 py-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                style={{
                  backgroundColor: isSelected || isHovered ? slice.surface : 'var(--color-surface)',
                  borderColor: isSelected || isHovered ? slice.color : 'var(--color-border)',
                  boxShadow: isSelected ? `0 5px 14px ${slice.color}22` : undefined,
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {slice.visualId ? (
                    <ExpenseIcon visualId={slice.visualId} title={slice.label} size="xs" />
                  ) : (
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-[var(--color-text)]">
                      {slice.label}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-[var(--color-muted)]">
                      {slice.expenseCount} {slice.expenseCount === 1 ? 'expense' : 'expenses'} · {slice.percent.toFixed(0)}%
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] font-medium text-[var(--color-muted)]">
        Select a slice or category to filter the expenses below.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {selectedSlice
          ? `${selectedSlice.label} selected. Showing ${selectedSlice.expenseCount} ${selectedSlice.expenseCount === 1 ? 'expense' : 'expenses'}, ${formatMoney(selectedSlice.amount, currency)}.`
          : `Showing all categories, ${formatMoney(total, currency)} total.`}
      </p>
    </div>
  );
};
