import React, { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Currency, ExchangeRate, Member, Trip } from '../types';
import { isDecimalInputValue, parsePositiveDecimal } from '../lib/decimalInput';
import { getTripExchangeRate } from '../lib/exchangeRates';

const CURRENCIES: Currency[] = ['AED', 'CNY', 'KZT'];

interface ExchangeRatesSheetProps {
  isOpen: boolean;
  trip: Trip;
  currentMember: Member;
  exchangeRates?: ExchangeRate[];
  onClose: () => void;
  onUpdateRate: (fromCurrency: Currency, toCurrency: Currency, rate: number) => Promise<void>;
}

export const ExchangeRatesSheet: React.FC<ExchangeRatesSheetProps> = ({
  isOpen,
  trip,
  currentMember,
  exchangeRates = [],
  onClose,
  onUpdateRate,
}) => {
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [savingPair, setSavingPair] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tripBaseCurrency = trip?.base_currency ?? 'CNY';
  const safeExchangeRates = useMemo(
    () => Array.isArray(exchangeRates) ? exchangeRates : [],
    [exchangeRates]
  );

  const pairs = useMemo(
    () => CURRENCIES.filter(currency => currency !== tripBaseCurrency),
    [tripBaseCurrency]
  );

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

  const handleSave = async (fromCurrency: Currency) => {
    const rawValue = rateInputs[fromCurrency] ?? '';
    const rate = parsePositiveDecimal(rawValue);

    if (rate === null) {
      setError('Exchange rate must be greater than zero.');
      return;
    }

    setSavingPair(fromCurrency);
    setError(null);
    try {
      await onUpdateRate(fromCurrency, tripBaseCurrency, rate);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save exchange rate.');
    } finally {
      setSavingPair(null);
    }
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
              Manual rates
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
            <div className="rounded-2xl border border-[var(--color-negative)]/40 bg-[var(--color-negative)]/15 px-3 py-2 text-xs text-rose-100">
              {error}
            </div>
          )}

          {pairs.map(fromCurrency => {
            const pairKey = `${fromCurrency}-${tripBaseCurrency}`;
            return (
              <div key={pairKey} className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-3">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  1 {fromCurrency} equals
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!isAdmin || savingPair === fromCurrency}
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
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleSave(fromCurrency)}
                      disabled={savingPair === fromCurrency}
                      className="w-11 h-11 rounded-2xl bg-indigo-600 text-slate-950 flex items-center justify-center cursor-pointer disabled:opacity-60"
                      aria-label={`Save ${fromCurrency} rate`}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!isAdmin && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Only approved admins can edit trip default exchange rates.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
