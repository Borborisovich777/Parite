import React, { useEffect, useMemo, useState } from 'react';
import { Trip, Member, Expense, ExpenseSplit, Currency, ExchangeRate } from '../types';
import {
  calculateConvertedAmount,
  calculateEqualSplits,
  validateCustomSplits,
} from '../lib/calculations';
import { isDecimalInputValue, parsePositiveDecimal } from '../lib/decimalInput';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  Edit2,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface ExpensesTabProps {
  trip: Trip;
  currentMember: Member;
  expenses: Expense[];
  splits: ExpenseSplit[];
  exchangeRates?: ExchangeRate[];
  members: Member[];
  onCreateExpense: (
    title: string,
    amount: number,
    currency: Currency,
    exchangeRate: number,
    convertedAmount: number,
    paidByMemberId: string,
    expenseDate: string,
    notes: string,
    splitsList: { member_id: string; amount_owed: number }[]
  ) => void | Promise<void>;
  onUpdateExpense: (
    expenseId: string,
    title: string,
    amount: number,
    currency: Currency,
    exchangeRate: number,
    convertedAmount: number,
    paidByMemberId: string,
    expenseDate: string,
    notes: string,
    splitsList: { member_id: string; amount_owed: number }[]
  ) => void | Promise<void>;
  onDeleteExpense: (expenseId: string) => void | Promise<void>;
  selectedExpenseIdForDetail: string | null;
  onSetSelectedExpenseId: (id: string | null) => void;
  isAddingExpense: boolean;
  onSetAddingExpense: (val: boolean) => void;
}

type FormStep = 'basic' | 'preview';

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  trip,
  currentMember,
  expenses,
  splits,
  exchangeRates = [],
  members,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
  selectedExpenseIdForDetail,
  onSetSelectedExpenseId,
  isAddingExpense,
  onSetAddingExpense,
}) => {
  const approvedMembers = members.filter(m => m.status === 'approved');
  const tripBaseCurrency = trip?.base_currency ?? 'CNY';
  const safeExchangeRates = useMemo(
    () => Array.isArray(exchangeRates) ? exchangeRates : [],
    [exchangeRates]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formStep, setFormStep] = useState<FormStep>('basic');
  const [showCustomizeSplit, setShowCustomizeSplit] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState<Currency>(tripBaseCurrency);
  const [useCustomExchangeRate, setUseCustomExchangeRate] = useState(false);
  const [customExchangeRateInput, setCustomExchangeRateInput] = useState('');
  const [formPayer, setFormPayer] = useState(currentMember.id);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formParticipants, setFormParticipants] = useState<string[]>(approvedMembers.map(m => m.id));
  const [formSplitMethod, setFormSplitMethod] = useState<'equal' | 'custom'>('equal');
  const [formCustomSplits, setFormCustomSplits] = useState<Record<string, string>>({});
  const [formNotes, setFormNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const amountValue = parseFloat(formAmount);
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0;
  const displayAmount = Number.isFinite(amountValue) ? amountValue : 0;
  const isBaseCurrencyExpense = formCurrency === tripBaseCurrency;
  const tripExchangeRate = useMemo(() => {
    if (formCurrency === tripBaseCurrency) return 1;
    if (!formCurrency || !tripBaseCurrency) return null;

    const match = safeExchangeRates.find(rate => (
      rate.from_currency === formCurrency &&
      rate.to_currency === tripBaseCurrency &&
      Number.isFinite(rate.rate) &&
      rate.rate > 0
    ));

    return match ? match.rate : null;
  }, [formCurrency, safeExchangeRates, tripBaseCurrency]);
  const customExchangeRate = parsePositiveDecimal(customExchangeRateInput);
  const activeExchangeRate = isBaseCurrencyExpense
    ? 1
    : useCustomExchangeRate
      ? customExchangeRate
      : tripExchangeRate;
  const hasValidRate = activeExchangeRate !== null;
  const rateValue = activeExchangeRate ?? Number.NaN;
  const convertedAmount = hasValidAmount && hasValidRate
    ? calculateConvertedAmount(amountValue, rateValue)
    : Number.NaN;
  const hasValidConvertedAmount = Number.isFinite(convertedAmount);

  const participantNames = formParticipants
    .map(id => approvedMembers.find(member => member.id === id)?.display_name)
    .filter(Boolean);

  const equalPreviewSplits = useMemo(
    () => hasValidConvertedAmount ? calculateEqualSplits(convertedAmount, formParticipants) : [],
    [convertedAmount, formParticipants, hasValidConvertedAmount]
  );

  const filteredExpenses = expenses.filter(expense => {
    const q = searchQuery.toLowerCase();
    const paidByMember = approvedMembers.find(m => m.id === expense.paid_by_member_id);
    return (
      expense.title.toLowerCase().includes(q) ||
      (expense.notes?.toLowerCase().includes(q) ?? false) ||
      (paidByMember?.display_name.toLowerCase().includes(q) ?? false)
    );
  }).sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

  const detailExpense = expenses.find(e => e.id === selectedExpenseIdForDetail);
  const detailSplits = detailExpense ? splits.filter(s => s.expense_id === detailExpense.id) : [];
  const detailPayer = detailExpense ? approvedMembers.find(m => m.id === detailExpense.paid_by_member_id) : null;

  useEffect(() => {
    if (formCurrency === tripBaseCurrency) {
      setUseCustomExchangeRate(false);
      setCustomExchangeRateInput('');
      return;
    }

    if (!editingExpense || editingExpense.currency !== formCurrency) {
      setUseCustomExchangeRate(false);
      setCustomExchangeRateInput('');
    }
  }, [formCurrency, tripBaseCurrency, editingExpense]);

  const initializeCustomSplits = (participantIds: string[]) => {
    const custom: Record<string, string> = {};
    participantIds.forEach(id => {
      custom[id] = '';
    });
    setFormCustomSplits(custom);
  };

  const resetFormView = () => {
    setFormStep('basic');
    setShowCustomizeSplit(false);
    setShowMoreOptions(false);
    setFormError(null);
  };

  const closeForm = () => {
    onSetAddingExpense(false);
    setEditingExpense(null);
    resetFormView();
  };

  const handleOpenAddForm = () => {
    const activeIds = approvedMembers.map(m => m.id);
    setFormTitle('');
    setFormAmount('');
    setFormCurrency(tripBaseCurrency);
    setUseCustomExchangeRate(false);
    setCustomExchangeRateInput('');
    setFormPayer(currentMember.id);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormParticipants(activeIds);
    setFormSplitMethod('equal');
    initializeCustomSplits(activeIds);
    setFormNotes('');
    setEditingExpense(null);
    resetFormView();
    onSetAddingExpense(true);
  };

  const handleOpenEditForm = (expense: Expense) => {
    const expenseSplits = splits.filter(s => s.expense_id === expense.id);
    const participantIds = expenseSplits.map(s => s.member_id);
    const equalsResult = calculateEqualSplits(expense.converted_amount, participantIds);
    let isSplitEqual = true;
    const custom: Record<string, string> = {};

    approvedMembers.forEach(member => {
      const split = expenseSplits.find(s => s.member_id === member.id);
      custom[member.id] = split ? split.amount_owed.toString() : '';
    });

    for (const split of expenseSplits) {
      const equalSplit = equalsResult.find(item => item.member_id === split.member_id);
      if (!equalSplit || Math.abs(equalSplit.amount_owed - split.amount_owed) > 0.01) {
        isSplitEqual = false;
        break;
      }
    }

    setEditingExpense(expense);
    setFormTitle(expense.title);
    setFormAmount(expense.amount.toString());
    setFormCurrency(expense.currency);
    if (expense.currency === tripBaseCurrency) {
      setUseCustomExchangeRate(false);
      setCustomExchangeRateInput('');
    } else {
      const currentTripRate = safeExchangeRates.find(rate => (
        rate.from_currency === expense.currency &&
        rate.to_currency === tripBaseCurrency &&
        Number.isFinite(rate.rate) &&
        rate.rate > 0
      ));
      const matchesTripRate = currentTripRate
        ? Math.abs(currentTripRate.rate - expense.exchange_rate_to_base) < 0.000001
        : false;
      setUseCustomExchangeRate(!matchesTripRate);
      setCustomExchangeRateInput(matchesTripRate ? '' : expense.exchange_rate_to_base.toString());
    }
    setFormPayer(expense.paid_by_member_id);
    setFormDate(expense.expense_date);
    setFormNotes(expense.notes || '');
    setFormParticipants(participantIds);
    setFormSplitMethod(isSplitEqual ? 'equal' : 'custom');
    setFormCustomSplits(custom);
    setFormStep('basic');
    setShowCustomizeSplit(!isSplitEqual);
    setShowMoreOptions(expense.currency !== tripBaseCurrency || Boolean(expense.notes));
    setFormError(null);
    onSetAddingExpense(false);
    onSetSelectedExpenseId(null);
  };

  const validateBasicFields = () => {
    if (!formTitle.trim()) {
      setFormError('Title is required');
      return false;
    }

    const amount = parseFloat(formAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setFormError('Amount must be greater than zero');
      return false;
    }

    if (!formPayer) {
      setFormError('Choose who paid');
      return false;
    }

    setFormError(null);
    return true;
  };

  const handleContinueToPreview = () => {
    if (!validateBasicFields()) return;

    if (formCurrency !== tripBaseCurrency && !hasValidRate) {
      setFormError(
        useCustomExchangeRate
          ? 'Enter a custom exchange rate greater than zero'
          : `No trip exchange rate set for ${formCurrency} -> ${tripBaseCurrency}. Ask admin to set it or enter a custom rate.`
      );
      setShowMoreOptions(true);
      setFormStep('preview');
      return;
    }

    setFormError(null);
    setFormStep('preview');
  };

  const buildSplitsList = (): { member_id: string; amount_owed: number }[] | null => {
    if (formParticipants.length === 0) {
      setFormError('At least one participant must be selected');
      return null;
    }

    if (!hasValidConvertedAmount) {
      setFormError('Enter a valid amount and exchange rate first');
      return null;
    }

    if (formSplitMethod === 'equal') {
      return calculateEqualSplits(convertedAmount, formParticipants);
    }

    const customSplitsToVerify: { member_id: string; amount_owed: number }[] = [];
    let hasInvalidInput = false;

    formParticipants.forEach(memberId => {
      const value = parseFloat(formCustomSplits[memberId] || '');
      if (Number.isNaN(value) || value < 0) {
        hasInvalidInput = true;
      }

      customSplitsToVerify.push({
        member_id: memberId,
        amount_owed: Math.round((Number.isFinite(value) ? value : 0) * 100) / 100,
      });
    });

    if (hasInvalidInput) {
      setFormError('Fill in custom split amounts for every selected participant');
      return null;
    }

    if (!validateCustomSplits(convertedAmount, customSplitsToVerify)) {
      const sum = customSplitsToVerify.reduce((total, item) => total + item.amount_owed, 0);
      setFormError(
        `Custom splits total ${sum.toFixed(2)} ${tripBaseCurrency}, but the converted amount is ${hasValidConvertedAmount ? convertedAmount.toFixed(2) : 'not ready'} ${tripBaseCurrency}`
      );
      return null;
    }

    return customSplitsToVerify;
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    if (!validateBasicFields()) return;

    const amount = parseFloat(formAmount);
    const exchangeRate = activeExchangeRate;
    if (exchangeRate === null || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setFormError(
        useCustomExchangeRate
          ? 'Exchange rate must be greater than zero'
          : `No trip exchange rate set for ${formCurrency} -> ${tripBaseCurrency}. Ask admin to set it or enter a custom rate.`
      );
      setShowMoreOptions(true);
      setFormStep('preview');
      return;
    }

    const splitsList = buildSplitsList();
    if (!splitsList) {
      setFormStep('preview');
      setShowCustomizeSplit(true);
      return;
    }

    setIsSaving(true);
    try {
      if (editingExpense) {
        await onUpdateExpense(
          editingExpense.id,
          formTitle.trim(),
          amount,
          formCurrency,
          exchangeRate,
          convertedAmount,
          formPayer,
          formDate,
          formNotes.trim(),
          splitsList
        );
      } else {
        await onCreateExpense(
          formTitle.trim(),
          amount,
          formCurrency,
          exchangeRate,
          convertedAmount,
          formPayer,
          formDate,
          formNotes.trim(),
          splitsList
        );
      }

      closeForm();
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : 'Could not save this expense');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExpenseIdForDetail) return;
    setIsSaving(true);
    try {
      await onDeleteExpense(selectedExpenseIdForDetail);
      setShowDeleteConfirm(false);
      onSetSelectedExpenseId(null);
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : 'Could not delete this expense');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setFormParticipants(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const isFormOpen = isAddingExpense || Boolean(editingExpense);
  const payerName = approvedMembers.find(member => member.id === formPayer)?.display_name ?? 'Unknown';
  const participantSummary = formParticipants.length === approvedMembers.length
    ? 'Everyone'
    : `${formParticipants.length} people`;
  const firstEqualSplit = equalPreviewSplits[0]?.amount_owed ?? 0;

  return (
    <div className="flex flex-col h-full pb-20 animate-fade-in relative">
      {isFormOpen ? (
        <form onSubmit={handleFormSubmit} className="flex min-h-full flex-col bg-[#121418]">
          <div className="sticky top-0 z-10 bg-[#121418]/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="w-10 h-10 rounded-xl bg-[#1a1d23] border border-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
              aria-label="Cancel expense form"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="min-w-0 text-center">
              <h2 id="expense-form-title" className="text-sm font-bold text-white font-display">
                {editingExpense ? 'Edit expense' : 'Add expense'}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {formStep === 'basic' ? 'Amount and title first' : 'Review and save'}
              </p>
            </div>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5">
            {formError && (
              <div className="mb-4 bg-rose-950/45 border border-rose-800/70 text-rose-200 p-3 rounded-2xl text-xs flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formStep === 'basic' ? (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    id="input-expense-amount"
                    value={formAmount}
                    onChange={event => setFormAmount(event.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#1a1d23] border border-slate-800 rounded-2xl px-4 py-4 font-mono text-3xl font-bold text-white placeholder-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-[1fr_120px] gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      What was it for?
                    </label>
                    <input
                      type="text"
                      id="input-expense-title"
                      required
                      value={formTitle}
                      onChange={event => setFormTitle(event.target.value)}
                      placeholder="Dinner, taxi, tickets"
                      className="w-full min-h-12 bg-[#1a1d23] border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Currency
                    </label>
                    <select
                      value={formCurrency}
                      id="select-expense-currency"
                      onChange={event => setFormCurrency(event.target.value as Currency)}
                      className="w-full min-h-12 bg-[#1a1d23] border border-slate-800 rounded-2xl px-3 py-3 text-sm font-bold text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="AED">AED</option>
                      <option value="CNY">CNY</option>
                      <option value="KZT">KZT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Paid by
                  </label>
                  <select
                    value={formPayer}
                    id="select-expense-payer"
                    onChange={event => setFormPayer(event.target.value)}
                    className="w-full min-h-12 bg-[#1a1d23] border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {approvedMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.display_name}{member.id === currentMember.id ? ' (You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <section className="rounded-3xl bg-[#1a1d23] border border-slate-800 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        Preview
                      </p>
                      <h3 className="text-lg font-bold text-white truncate mt-1">{formTitle}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Paid by <span className="font-semibold text-slate-200">{payerName}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-lg font-bold text-white">
                        {displayAmount.toFixed(2)} {formCurrency}
                      </p>
                      {formCurrency !== tripBaseCurrency && (
                        <>
                          <p className="text-[10px] text-indigo-300 font-mono mt-1">
                            {hasValidConvertedAmount ? `${convertedAmount.toFixed(2)} ${tripBaseCurrency}` : 'Enter rate'}
                          </p>
                          {hasValidRate && (
                            <p className="text-[10px] text-slate-500 font-mono mt-1">
                              {useCustomExchangeRate ? 'Custom' : 'Trip'} rate {rateValue.toString()}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl bg-[#121418] border border-slate-800 p-3">
                      <p className="text-slate-500 mb-1">Split between</p>
                      <p className="text-slate-100 font-semibold">{participantSummary}</p>
                    </div>
                    <div className="rounded-2xl bg-[#121418] border border-slate-800 p-3">
                      <p className="text-slate-500 mb-1">Each person owes</p>
                      <p className="text-slate-100 font-mono font-bold">
                        {formSplitMethod === 'equal'
                          ? hasValidConvertedAmount
                            ? `${firstEqualSplit.toFixed(2)} ${tripBaseCurrency}`
                            : 'Enter rate'
                          : 'Custom'}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomizeSplit(prev => !prev)}
                    className={`min-h-12 rounded-2xl border px-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${
                      showCustomizeSplit
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-[#1a1d23] border-slate-800 text-slate-200'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Customize
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions(prev => !prev)}
                    className={`min-h-12 rounded-2xl border px-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${
                      showMoreOptions
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-[#1a1d23] border-slate-800 text-slate-200'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    More
                  </button>
                </div>

                {showCustomizeSplit && (
                  <section className="rounded-3xl bg-[#1a1d23] border border-slate-800 p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">Customize split</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Select people and choose equal or custom amounts.
                        </p>
                      </div>
                      <button
                        type="button"
                        id="btn-split-all-match"
                        onClick={() => setFormParticipants(approvedMembers.map(member => member.id))}
                        className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl cursor-pointer"
                      >
                        Select all
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      {approvedMembers.map(member => {
                        const isChecked = formParticipants.includes(member.id);
                        return (
                          <button
                            type="button"
                            key={member.id}
                            id={`checkbox-participant-${member.id}`}
                            onClick={() => toggleParticipant(member.id)}
                            className={`min-h-11 rounded-2xl border px-3 py-2 flex items-center gap-3 text-left cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-500/10 border-indigo-500/35 text-white'
                                : 'bg-[#121418] border-slate-800 text-slate-400'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                              isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700'
                            }`}>
                              {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                            </span>
                            <span className="text-sm font-semibold truncate">{member.display_name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#121418] border border-slate-800 p-1 rounded-2xl">
                      <button
                        type="button"
                        id="btn-split-equal"
                        onClick={() => setFormSplitMethod('equal')}
                        className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                          formSplitMethod === 'equal' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        Equal
                      </button>
                      <button
                        type="button"
                        id="btn-split-custom"
                        onClick={() => setFormSplitMethod('custom')}
                        className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                          formSplitMethod === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        Custom
                      </button>
                    </div>

                    {formSplitMethod === 'equal' ? (
                      <div className="flex flex-col gap-2">
                        {equalPreviewSplits.map(item => {
                          const member = approvedMembers.find(m => m.id === item.member_id);
                          return (
                            <div key={item.member_id} className="flex items-center justify-between text-xs text-slate-400">
                              <span>{member?.display_name ?? 'Participant'}</span>
                              <span className="font-mono font-bold text-slate-100">
                                {item.amount_owed.toFixed(2)} {tripBaseCurrency}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {formParticipants.map(participantId => {
                          const member = approvedMembers.find(m => m.id === participantId);
                          return (
                            <label key={participantId} className="flex items-center justify-between gap-3 rounded-2xl bg-[#121418] border border-slate-800 px-3 py-2">
                              <span className="text-sm font-semibold text-slate-200 truncate">
                                {member?.display_name ?? 'Participant'}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                <input
                                  type="number"
                                  step="0.01"
                                  id={`input-custom-split-${participantId}`}
                                  value={formCustomSplits[participantId] || ''}
                                  onChange={event => setFormCustomSplits(prev => ({
                                    ...prev,
                                    [participantId]: event.target.value,
                                  }))}
                                  placeholder="0.00"
                                  className="w-24 bg-[#1a1d23] border border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-right text-slate-100 focus:border-indigo-500 focus:outline-none"
                                />
                                <span className="text-[10px] font-mono text-slate-500">{tripBaseCurrency}</span>
                              </span>
                            </label>
                          );
                        })}
                        <div className="flex justify-between border-t border-slate-800 pt-3 text-xs">
                          <span className="text-slate-500">Custom total</span>
                          <span className="font-mono text-slate-200">
                            {formParticipants.reduce((sum, id) => sum + parseFloat(formCustomSplits[id] || '0'), 0).toFixed(2)}
                            {' / '}
                            {hasValidConvertedAmount ? convertedAmount.toFixed(2) : '--'} {tripBaseCurrency}
                          </span>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {showMoreOptions && (
                  <section className="rounded-3xl bg-[#1a1d23] border border-slate-800 p-4 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-white">More options</h3>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        required
                        id="input-expense-date"
                        value={formDate}
                        onChange={event => setFormDate(event.target.value)}
                        className="w-full min-h-12 bg-[#121418] border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {formCurrency !== tripBaseCurrency && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Exchange rate
                        </label>
                        {!useCustomExchangeRate && tripExchangeRate && (
                          <div className="rounded-2xl bg-[#121418] border border-slate-800 px-4 py-3">
                            <p className="text-xs text-slate-300">
                              Using trip rate:
                            </p>
                            <p className="font-mono text-sm text-indigo-300 mt-1">
                              1 {formCurrency} = {tripExchangeRate.toString()} {tripBaseCurrency}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setUseCustomExchangeRate(true);
                                setCustomExchangeRateInput('');
                              }}
                              className="mt-3 text-[11px] font-bold text-indigo-300 cursor-pointer"
                            >
                              Use custom exchange rate
                            </button>
                          </div>
                        )}

                        {!useCustomExchangeRate && !tripExchangeRate && (
                          <div className="rounded-2xl bg-[#121418] border border-slate-800 px-4 py-3">
                            <p className="text-xs text-slate-400 leading-relaxed">
                              No trip exchange rate set for {formCurrency} -&gt; {tripBaseCurrency}. Ask admin to set it or enter a custom rate.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setUseCustomExchangeRate(true);
                                setCustomExchangeRateInput('');
                              }}
                              className="mt-3 text-[11px] font-bold text-indigo-300 cursor-pointer"
                            >
                              Enter custom rate
                            </button>
                          </div>
                        )}

                        {useCustomExchangeRate && (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-400">1 {formCurrency} =</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                id="input-exchange-rate"
                                value={customExchangeRateInput}
                                onChange={event => {
                                  const nextValue = event.target.value;
                                  if (isDecimalInputValue(nextValue)) {
                                    setCustomExchangeRateInput(nextValue);
                                  }
                                }}
                                placeholder="Required"
                                className="min-w-0 flex-1 bg-[#121418] border border-slate-800 rounded-2xl px-4 py-3 font-mono text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                              />
                              <span className="text-xs font-mono text-slate-400">{tripBaseCurrency}</span>
                            </div>
                            {tripExchangeRate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUseCustomExchangeRate(false);
                                  setCustomExchangeRateInput('');
                                }}
                                className="mt-3 text-[11px] font-bold text-indigo-300 cursor-pointer"
                              >
                                Use trip rate
                              </button>
                            )}
                          </div>
                        )}
                        {hasValidConvertedAmount ? (
                          <p className="text-[11px] text-indigo-300 mt-2 font-mono">
                            {displayAmount.toFixed(2)} {formCurrency} approx {convertedAmount.toFixed(2)} {tripBaseCurrency}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-2">
                            Enter a valid amount and rate to preview the converted total.
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={formNotes}
                        id="input-expense-notes"
                        onChange={event => setFormNotes(event.target.value)}
                        placeholder="Optional memo"
                        rows={3}
                        className="w-full bg-[#121418] border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-800 bg-[#121418] p-4 flex gap-3">
            {formStep === 'basic' ? (
              <>
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-12 flex-1 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-300 font-bold text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinueToPreview}
                  className="min-h-12 flex-[1.4] rounded-2xl bg-indigo-600 text-white font-bold text-sm cursor-pointer accent-glow"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFormStep('basic')}
                  className="min-h-12 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-300 px-4 font-bold text-sm cursor-pointer flex items-center justify-center"
                  aria-label="Back to basic fields"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  id="btn-expense-submit"
                  disabled={isSaving}
                  className="min-h-12 flex-1 rounded-2xl bg-indigo-600 text-white font-bold text-sm cursor-pointer accent-glow"
                >
                  {isSaving ? 'Saving...' : editingExpense ? 'Save changes' : 'Save expense'}
                </button>
              </>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="px-4 pt-4 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold font-display text-white tracking-tight">
                  Expenses
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {expenses.length} total in this trip
                </p>
              </div>

              <button
                id="btn-add-expense-tab"
                onClick={handleOpenAddForm}
                className="w-12 h-12 bg-indigo-600 hover:bg-[#5334f5] active:scale-95 text-white rounded-full shadow-lg transition-all flex items-center justify-center cursor-pointer accent-glow"
                title="Add Expense"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                id="expense-search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search expenses"
                className="w-full bg-[#1a1d23] border border-slate-800/90 rounded-2xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:outline-none text-slate-200 placeholder-slate-500"
              />
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 mt-3 no-scrollbar">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-14 px-4 border border-dashed border-slate-800 rounded-3xl bg-[#1a1d23]">
                <Search className="w-9 h-9 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-300 font-semibold">
                  {searchQuery ? 'No expenses found' : 'No expenses yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {searchQuery ? 'Try a different search.' : 'Tap the plus button to add the first shared cost.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pb-16">
                {filteredExpenses.map(expense => {
                  const paidBy = approvedMembers.find(m => m.id === expense.paid_by_member_id);
                  return (
                    <button
                      type="button"
                      key={expense.id}
                      id={`expense-card-${expense.id}`}
                      onClick={() => onSetSelectedExpenseId(expense.id)}
                      className="w-full bg-[#1a1d23] border border-slate-800/75 hover:border-slate-700 hover:bg-[#20242b] rounded-2xl p-4 transition-all cursor-pointer flex justify-between items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-100 truncate block">
                          {expense.title}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-1 block truncate">
                          Paid by {paidBy ? (paidBy.id === currentMember.id ? 'You' : paidBy.display_name) : 'Removed member'} - {expense.expense_date}
                        </span>
                      </span>

                      <span className="text-right shrink-0">
                        <span className="font-mono text-sm font-bold text-slate-100 block">
                          {expense.amount.toFixed(2)} {expense.currency}
                        </span>
                        {expense.currency !== tripBaseCurrency && (
                          <span className="text-[10px] text-slate-500 font-mono block mt-1">
                            {Number.isFinite(expense.converted_amount) ? expense.converted_amount.toFixed(2) : '--'} {tripBaseCurrency}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {detailExpense && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-[#121418] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col border border-slate-800 animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-display">Expense details</h3>
              <button
                type="button"
                onClick={() => onSetSelectedExpenseId(null)}
                className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                aria-label="Close expense details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1 flex flex-col gap-4 no-scrollbar">
              <div>
                <h4 id="detail-expense-title" className="text-lg font-bold text-white leading-snug">
                  {detailExpense.title}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{detailExpense.expense_date}</span>
                </div>
              </div>

              <div className="rounded-3xl bg-[#1a1d23] border border-slate-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Amount
                    </p>
                    <p className="font-mono text-xl font-bold text-slate-100 mt-1">
                      {detailExpense.amount.toFixed(2)} {detailExpense.currency}
                    </p>
                  </div>
                  {detailExpense.currency !== tripBaseCurrency && (
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        Converted
                      </p>
                      <p className="font-mono text-sm font-bold text-indigo-300 mt-1">
                        {Number.isFinite(detailExpense.converted_amount) ? detailExpense.converted_amount.toFixed(2) : '--'} {tripBaseCurrency}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">
                        Rate {Number.isFinite(detailExpense.exchange_rate_to_base) ? detailExpense.exchange_rate_to_base.toFixed(4) : '--'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  Paid by
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs uppercase">
                    {detailPayer ? detailPayer.display_name.charAt(0) : 'R'}
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    {detailPayer ? (detailPayer.id === currentMember.id ? 'You' : detailPayer.display_name) : 'Removed member'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  Split
                </p>
                <div className="flex flex-col gap-2 rounded-3xl border border-slate-800 bg-[#1a1d23] p-3">
                  {detailSplits.map(split => {
                    const participant = approvedMembers.find(m => m.id === split.member_id);
                    return (
                      <div key={split.id} className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 truncate">
                          {participant ? (participant.id === currentMember.id ? 'You' : participant.display_name) : 'Removed member'}
                        </span>
                        <span className="font-mono font-bold text-slate-100">
                          {Number.isFinite(split.amount_owed) ? split.amount_owed.toFixed(2) : '--'} {tripBaseCurrency}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {detailExpense.notes && (
                <div className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">{detailExpense.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-[#1a1d23] border-t border-slate-800 p-4 shrink-0">
              {currentMember.role === 'admin' || detailExpense.created_by_member_id === currentMember.id ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="btn-edit-expense"
                    onClick={() => handleOpenEditForm(detailExpense)}
                    className="flex items-center justify-center gap-2 bg-[#121418] border border-slate-800 hover:bg-[#20242b] text-slate-200 font-bold min-h-11 px-4 rounded-2xl text-sm cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    id="btn-delete-confirm-open"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center gap-2 bg-rose-950/40 border border-rose-800/45 text-rose-200 font-bold min-h-11 px-4 rounded-2xl text-sm cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center leading-normal">
                  Only the creator or an admin can modify this expense.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#121418] rounded-3xl p-5 shadow-2xl max-w-sm w-full border border-slate-800 flex flex-col gap-4 animate-fade-in">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-rose-950/50 border border-rose-900/40 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white font-display">Delete expense?</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                This will remove the expense and recalculate balances for the trip.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-[#1a1d23] border border-slate-800 text-slate-300 font-bold min-h-11 px-4 rounded-2xl text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-delete-expense-submit"
                onClick={handleDelete}
                disabled={isSaving}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold min-h-11 px-4 rounded-2xl text-sm cursor-pointer"
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
