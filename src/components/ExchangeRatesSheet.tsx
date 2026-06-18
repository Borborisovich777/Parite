import React, { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Currency, ExchangeRate, Member, SUPPORTED_CURRENCIES, Trip } from '../types';
import { isDecimalInputValue, parsePositiveDecimal } from '../lib/decimalInput';
import { getTripExchangeRate } from '../lib/exchangeRates';

interface ExchangeRatesSheetProps {
  isOpen: boolean;
  trip: Trip;
  currentMember: Member;
  members?: Member[];
  exchangeRates?: ExchangeRate[];
  canEdit: boolean;
  onClose: () => void;
  onUpdateRate: (fromCurrency: Currency, toCurrency: Currency, rate: number) => Promise<void>;
  onActionError?: (message: string) => void;
}

export const ExchangeRatesSheet: React.FC<ExchangeRatesSheetProps> = ({
  isOpen,
  trip,
  currentMember,
  members = [],
  exchangeRates = [],
  canEdit,
  onClose,
  onUpdateRate,
  onActionError,
}) => {
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [savingPair, setSavingPair] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tripBaseCurrency = trip?.base_currency ?? 'CNY';
  const tripStatus = trip.status ?? 'active';
  const isTripReadOnly = tripStatus === 'closing' || tripStatus === 'closed';
  const safeExchangeRates = useMemo(
    () => Array.isArray(exchangeRates) ? exchangeRates : [],
    [exchangeRates]
  );

  const pairs = useMemo(
    () => SUPPORTED_CURRENCIES.filter(currency => currency !== tripBaseCurrency),
    [tripBaseCurrency]
  );

  const currentTripRates = useMemo(
    () => safeExchangeRates.filter(rate => rate.trip_id === trip.id && Number.isFinite(Number(rate.rate)) && Number(rate.rate) > 0),
    [safeExchangeRates, trip.id]
  );

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach(member => map.set(member.id, member.display_name));
    return map;
  }, [members]);

  useEffect(() => {
    if (!isOpen) return;

    const nextInputs: Record<string, string> = {};
    pairs.forEach(fromCurrency => {
      const rate = getTripExchangeRate(safeExchangeRates, trip?.id, fromCurrency, tripBaseCurrency);
      nextInputs[fromCurrency] = rate ? rate.rate.toString() : '';
    });

    setRateInputs(nextInputs);
    setError(null);
    setSavingPair(null);
  }, [isOpen, pairs, safeExchangeRates, trip?.id, tripBaseCurrency]);

  if (!isOpen) return null;

  const isAdmin = currentMember.role === 'admin' && currentMember.status === 'approved';
  const canEditRates = canEdit && isAdmin && !isTripReadOnly;
  const helperText = isTripReadOnly
    ? 'This trip is read-only. Exchange rates can still be viewed.'
    : canEditRates
      ? null
      : 'Exchange rates are managed by trip admins.';
  const getSafeMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error) || !error.message.trim()) return fallback;

    const message = error.message.trim();
    const looksRaw = /(PGRST|SQLSTATE|violates|constraint|duplicate key|invalid input syntax|relation .* does not exist|function .* does not exist|column .* does not exist)/i.test(message);

    return looksRaw ? fallback : message;
  };

  const handleSave = async (fromCurrency: Currency) => {
    if (!canEditRates) {
      const message = isTripReadOnly
        ? 'This trip is read-only. Exchange rates can still be viewed.'
        : 'Only trip admins can update exchange rates.';
      setError(message);
      onActionError?.(message);
      return;
    }

    const rawValue = rateInputs[fromCurrency] ?? '';
    const rate = parsePositiveDecimal(rawValue);

    if (rate === null) {
      const message = 'Exchange rate must be greater than zero.';
      setError(message);
      onActionError?.(message);
      return;
    }

    setSavingPair(fromCurrency);
    setError(null);
    try {
      await onUpdateRate(fromCurrency, tripBaseCurrency, rate);
    } catch (saveError) {
      console.error(saveError);
      const fallback = isTripReadOnly
        ? 'This trip is read-only. Exchange rates can still be viewed.'
        : !isAdmin
          ? 'Only trip admins can update exchange rates.'
          : 'Could not save exchange rate.';
      const message = getSafeMessage(saveError, fallback);
      setError(message);
      onActionError?.(message);
    } finally {
      setSavingPair(null);
    }
  };

  const formatUpdatedAt = (value: string | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const renderRateMeta = (rate: ExchangeRate | null) => {
    if (!rate) return null;

    const updatedAt = formatUpdatedAt(rate.updated_at);
    const updatedBy = rate.updated_by_member_id ? memberNameById.get(rate.updated_by_member_id) : null;
    const meta = [
      updatedAt ? `Updated ${updatedAt}` : null,
      updatedBy ? `by ${updatedBy}` : null,
    ].filter(Boolean).join(' ');

    return meta ? (
      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
        {meta}
      </p>
    ) : null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex max-w-md mx-auto">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] cursor-default"
        aria-label="Close exchange rates"
        onClick={onClose}
      />

      <section className="relative z-10 mt-auto w-full rounded-t-[28px] border border-slate-800 bg-[#121418] shadow-2xl animate-slide-up">
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              Exchange rates
            </p>
            <h2 className="text-lg font-bold text-white font-display truncate">
              Defaults to {tripBaseCurrency}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#1a1d23] border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close exchange rates"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3">
          {error && (
            <div className="rounded-2xl border border-[#e07a5f] bg-[#e07a5f] px-3 py-2 text-xs font-bold text-[#3d405b]">
              {error}
            </div>
          )}

          {helperText && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {helperText}
            </p>
          )}

          {canEditRates ? (
            <>
              {currentTripRates.length === 0 && (
                <p className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-3 text-xs text-slate-400 leading-relaxed">
                  No exchange rates set yet. Add rates for currencies used in this trip.
                </p>
              )}
              {pairs.map(fromCurrency => {
                const pairKey = `${fromCurrency}-${tripBaseCurrency}`;
                const rate = getTripExchangeRate(safeExchangeRates, trip?.id, fromCurrency, tripBaseCurrency);
                return (
                  <div key={pairKey} className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-3">
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                      1 {fromCurrency} equals
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={savingPair === fromCurrency}
                        value={rateInputs[fromCurrency] ?? ''}
                        onChange={event => setRateInputs(prev => ({
                          ...prev,
                          [fromCurrency]: isDecimalInputValue(event.target.value)
                            ? event.target.value
                            : prev[fromCurrency] ?? '',
                        }))}
                        placeholder="Manual rate"
                        className="min-w-0 flex-1 bg-[#121418] border border-slate-800 rounded-2xl px-4 py-3 font-mono text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                      />
                      <span className="text-xs font-mono text-slate-400">{tripBaseCurrency}</span>
                      <button
                        type="button"
                        onClick={() => handleSave(fromCurrency)}
                        disabled={savingPair === fromCurrency}
                        className="w-11 h-11 rounded-2xl bg-indigo-600 text-slate-950 flex items-center justify-center cursor-pointer disabled:opacity-60"
                        aria-label={`Save ${fromCurrency} rate`}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                    {renderRateMeta(rate)}
                  </div>
                );
              })}
            </>
          ) : currentTripRates.length > 0 ? (
            currentTripRates.map(rate => (
              <div key={rate.id} className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  {rate.from_currency} to {rate.to_currency}
                </p>
                <p className="font-mono text-sm font-bold text-slate-100">
                  1 {rate.from_currency} = {rate.rate.toString()} {rate.to_currency}
                </p>
                {renderRateMeta(rate)}
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-3 text-xs text-slate-400 leading-relaxed">
              {isAdmin
                ? 'No exchange rates set yet. Add rates for currencies used in this trip.'
                : 'No exchange rates have been set yet. Ask a trip admin to add them.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
