import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trip, Member, Expense, ExpenseSplit, Currency, ExchangeRate, Settlement, ExpenseFeeInput, ExpenseSplitInput, SUPPORTED_CURRENCIES } from '../types';
import {
  calculateConvertedAmount,
  calculateOpenMemberBalances,
  calculateSmartCustomSplitsWithFee,
} from '../lib/calculations';
import { isDecimalInputValue, isMoneyInputValue, parsePositiveDecimal } from '../lib/decimalInput';
import { formatDisplayMoney, getMemberDisplayCurrency, getTripExchangeRate } from '../lib/exchangeRates';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Edit2,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';

interface ExpensesTabProps {
  trip: Trip;
  currentMember: Member;
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
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
    splitsList: ExpenseSplitInput[],
    feeInput?: ExpenseFeeInput | null
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
    splitsList: ExpenseSplitInput[],
    feeInput?: ExpenseFeeInput | null
  ) => void | Promise<void>;
  onDeleteExpense: (expenseId: string) => void | Promise<void>;
  selectedExpenseIdForDetail: string | null;
  onSetSelectedExpenseId: (id: string | null) => void;
  isAddingExpense: boolean;
  onSetAddingExpense: (val: boolean) => void;
  isReadOnly?: boolean;
  onActionError?: (message: string) => void;
}

type FormStep = 'basic' | 'preview';

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  trip,
  currentMember,
  expenses,
  splits,
  settlements,
  exchangeRates = [],
  members,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
  selectedExpenseIdForDetail,
  onSetSelectedExpenseId,
  isAddingExpense,
  onSetAddingExpense,
  isReadOnly = false,
  onActionError,
}) => {
  const approvedMembers = members.filter(m => m.status === 'approved');
  const tripBaseCurrency = trip?.base_currency ?? 'CNY';
  const displayCurrency = getMemberDisplayCurrency(currentMember, trip);
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
  const [isServiceFeeEnabled, setIsServiceFeeEnabled] = useState(false);
  const [feePercentInput, setFeePercentInput] = useState('');
  const [feeLabelInput, setFeeLabelInput] = useState('Service fee');
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
  const submitSourceRef = useRef<string | null>(null);

  const setBlockingError = (message: string) => {
    setFormError(message);
    onActionError?.(message);
  };

  const setValidationError = (message: string) => {
    setBlockingError(message);
  };

  const getBlockingErrorMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error) || !error.message.trim()) return fallback;

    const message = error.message.trim();
    const looksRaw = /(PGRST|SQLSTATE|violates|constraint|duplicate key|invalid input syntax|relation .* does not exist|function .* does not exist|column .* does not exist)/i.test(message);

    return looksRaw ? fallback : message;
  };

  const setFormStepWithReason = (nextStep: FormStep, reason: string) => {
    void reason;
    setFormStep(previousStep => {
      void previousStep;
      return nextStep;
    });
  };

  const setFormCurrencyWithReason = (nextCurrency: Currency, reason: string) => {
    void reason;
    setFormCurrency(previousCurrency => {
      void previousCurrency;
      return nextCurrency;
    });
  };

  const roundMoney = (value: number) => Math.round(value * 100) / 100;
  const subtotalValue = parseFloat(formAmount);
  const hasValidAmount = Number.isFinite(subtotalValue) && subtotalValue > 0;
  const feePercentValue = isServiceFeeEnabled && feePercentInput.trim() !== ''
    ? Number(feePercentInput)
    : 0;
  const hasValidFeePercent = !isServiceFeeEnabled
    || (Number.isFinite(feePercentValue) && feePercentValue >= 0 && feePercentValue <= 100);
  const feeAmountValue = hasValidAmount && hasValidFeePercent && isServiceFeeEnabled
    ? roundMoney(subtotalValue * feePercentValue / 100)
    : 0;
  const amountValue = hasValidAmount ? roundMoney(subtotalValue + feeAmountValue) : Number.NaN;
  const displayAmount = Number.isFinite(amountValue) ? amountValue : 0;
  const isBaseCurrencyExpense = formCurrency === tripBaseCurrency;
  const tripExchangeRate = useMemo(() => {
    if (formCurrency === tripBaseCurrency) return 1;
    const match = getTripExchangeRate(safeExchangeRates, trip?.id, formCurrency, tripBaseCurrency);
    return match ? match.rate : null;
  }, [formCurrency, safeExchangeRates, trip?.id, tripBaseCurrency]);

  const customExchangeRate = parsePositiveDecimal(customExchangeRateInput);
  const activeExchangeRate = isBaseCurrencyExpense
    ? 1
    : useCustomExchangeRate
      ? customExchangeRate
      : tripExchangeRate;
  const hasValidRate = activeExchangeRate !== null;
  const rateValue = activeExchangeRate ?? Number.NaN;
  const convertedSubtotalAmount = hasValidAmount && hasValidRate
    ? calculateConvertedAmount(subtotalValue, rateValue)
    : Number.NaN;
  const convertedAmount = hasValidAmount && hasValidRate && hasValidFeePercent
    ? calculateConvertedAmount(amountValue, rateValue)
    : Number.NaN;
  const convertedFeeAmount = Number.isFinite(convertedAmount) && Number.isFinite(convertedSubtotalAmount)
    ? roundMoney(convertedAmount - convertedSubtotalAmount)
    : Number.NaN;
  const hasValidConvertedAmount = Number.isFinite(convertedAmount);

  const participantNames = formParticipants
    .map(id => approvedMembers.find(member => member.id === id)?.display_name)
    .filter(Boolean);
  const totalSpending = expenses.reduce((sum, expense) => sum + expense.converted_amount, 0);
  const balances = calculateOpenMemberBalances(expenses, splits, settlements, approvedMembers);
  const currentUserBalance = balances.find(balance => balance.member_id === currentMember.id);
  const userBalanceDisplay = formatDisplayMoney(
    currentUserBalance?.net_balance ?? 0,
    tripBaseCurrency,
    displayCurrency,
    safeExchangeRates,
    trip.id
  );
  const totalSpendingDisplay = formatDisplayMoney(
    totalSpending,
    tripBaseCurrency,
    displayCurrency,
    safeExchangeRates,
    trip.id
  );
  const balanceLabel = !currentUserBalance || Math.abs(currentUserBalance.net_balance) <= 0.01
    ? 'Settled up'
    : currentUserBalance.net_balance > 0
      ? 'You are owed'
      : 'You owe';

  const equalSplitResult = useMemo(
    () => calculateSmartCustomSplitsWithFee({
      subtotalBaseAmount: hasValidConvertedAmount && Number.isFinite(convertedSubtotalAmount) ? convertedSubtotalAmount : 0,
      finalBaseAmount: hasValidConvertedAmount ? convertedAmount : 0,
      participantIds: formParticipants,
      manualSubtotalAmounts: {},
    }),
    [convertedAmount, convertedSubtotalAmount, formParticipants, hasValidConvertedAmount]
  );
  const equalPreviewSplits = equalSplitResult.splits;
  const smartCustomSplitResult = useMemo(
    () => calculateSmartCustomSplitsWithFee({
      subtotalBaseAmount: hasValidConvertedAmount && Number.isFinite(convertedSubtotalAmount) ? convertedSubtotalAmount : 0,
      finalBaseAmount: hasValidConvertedAmount ? convertedAmount : 0,
      participantIds: formParticipants,
      manualSubtotalAmounts: formCustomSplits,
    }),
    [convertedAmount, convertedSubtotalAmount, formCustomSplits, formParticipants, hasValidConvertedAmount]
  );

  const filteredExpenses = expenses.filter(expense => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const paidByMember = approvedMembers.find(m => m.id === expense.paid_by_member_id);
    const searchable = [
      expense.title,
      expense.notes ?? '',
      paidByMember?.display_name ?? '',
      expense.amount.toString(),
      expense.amount.toFixed(2),
      (expense.subtotal_amount ?? '').toString(),
      (expense.fee_percent ?? '').toString(),
      expense.fee_label ?? '',
      expense.converted_amount.toString(),
      expense.converted_amount.toFixed(2),
      expense.currency,
      tripBaseCurrency,
      expense.expense_date,
      new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString(),
    ].join(' ').toLowerCase();

    return searchable.includes(q);
  }).sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

  const detailExpense = expenses.find(e => e.id === selectedExpenseIdForDetail);
  const detailSplits = detailExpense ? splits.filter(s => s.expense_id === detailExpense.id) : [];
  const detailPayer = detailExpense ? approvedMembers.find(m => m.id === detailExpense.paid_by_member_id) : null;
  const detailDisplayAmount = detailExpense
    ? formatDisplayMoney(detailExpense.converted_amount, tripBaseCurrency, displayCurrency, safeExchangeRates, trip.id)
    : null;

  useEffect(() => {
    if (formCurrency === tripBaseCurrency && (useCustomExchangeRate || customExchangeRateInput)) {
      setUseCustomExchangeRate(false);
      setCustomExchangeRateInput('');
    }
  }, [
    customExchangeRateInput,
    editingExpense?.id,
    formCurrency,
    tripBaseCurrency,
    useCustomExchangeRate,
  ]);

  const initializeCustomSplits = (participantIds: string[]) => {
    const custom: Record<string, string> = {};
    participantIds.forEach(id => {
      custom[id] = '';
    });
    setFormCustomSplits(custom);
  };

  const resetFormView = (reason: string) => {
    setFormStepWithReason('basic', `reset:${reason}`);
    setShowCustomizeSplit(false);
    setShowMoreOptions(false);
    setFormError(null);
  };

  const closeForm = () => {
    onSetAddingExpense(false);
    setEditingExpense(null);
    resetFormView('close-form');
  };

  const handleOpenAddForm = () => {
    if (isReadOnly) return;

    const activeIds = approvedMembers.map(m => m.id);
    setFormTitle('');
    setFormAmount('');
    setIsServiceFeeEnabled(false);
    setFeePercentInput('');
    setFeeLabelInput('Service fee');
    setFormCurrencyWithReason(tripBaseCurrency, 'open-add-form');
    setUseCustomExchangeRate(false);
    setCustomExchangeRateInput('');
    setFormPayer(currentMember.id);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormParticipants(activeIds);
    setFormSplitMethod('equal');
    initializeCustomSplits(activeIds);
    setFormNotes('');
    setEditingExpense(null);
    resetFormView('open-add-form');
    onSetAddingExpense(true);
  };

  const handleOpenEditForm = (expense: Expense) => {
    if (isReadOnly) return;

    const expenseSplits = splits.filter(s => s.expense_id === expense.id);
    const participantIds = expenseSplits.map(s => s.member_id);
    const expenseSubtotal = expense.subtotal_amount ?? expense.amount;
    const expenseFeePercent = expense.fee_percent ?? 0;
    const hasExpenseFee = expenseFeePercent > 0 || (expense.fee_amount ?? 0) > 0;
    const expenseConvertedSubtotal = calculateConvertedAmount(expenseSubtotal, expense.exchange_rate_to_base);
    const equalsResult = calculateSmartCustomSplitsWithFee({
      subtotalBaseAmount: expenseConvertedSubtotal,
      finalBaseAmount: expense.converted_amount,
      participantIds,
      manualSubtotalAmounts: {},
    }).splits;
    let isSplitEqual = true;
    const custom: Record<string, string> = {};

    approvedMembers.forEach(member => {
      const split = expenseSplits.find(s => s.member_id === member.id);
      const splitAmount = hasExpenseFee
        ? split?.subtotal_amount_owed ?? split?.amount_owed
        : split?.amount_owed;
      custom[member.id] = splitAmount !== undefined ? splitAmount.toString() : '';
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
    setFormAmount(expenseSubtotal.toString());
    setIsServiceFeeEnabled(hasExpenseFee);
    setFeePercentInput(hasExpenseFee ? expenseFeePercent.toString() : '');
    setFeeLabelInput(expense.fee_label || 'Service fee');
    setFormCurrencyWithReason(expense.currency, 'open-edit-form');
    if (expense.currency === tripBaseCurrency) {
      setUseCustomExchangeRate(false);
      setCustomExchangeRateInput('');
    } else {
      const currentTripRate = getTripExchangeRate(safeExchangeRates, trip?.id, expense.currency, tripBaseCurrency);
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
    setFormStepWithReason('basic', 'open-edit-form');
    setShowCustomizeSplit(!isSplitEqual);
    setShowMoreOptions(expense.currency !== tripBaseCurrency || Boolean(expense.notes) || hasExpenseFee);
    setFormError(null);
    onSetAddingExpense(false);
    onSetSelectedExpenseId(null);
  };

  const validateBasicFields = () => {
    if (!formTitle.trim()) {
      setValidationError('Title is required');
      return false;
    }

    const amount = parseFloat(formAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setValidationError(isServiceFeeEnabled ? 'Subtotal must be greater than zero' : 'Amount must be greater than zero');
      return false;
    }

    if (!hasValidFeePercent) {
      setValidationError('Service fee must be between 0 and 100 percent');
      return false;
    }

    if (!formPayer) {
      setValidationError('Choose who paid');
      return false;
    }

    setFormError(null);
    return true;
  };

  const handleContinueToPreview = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    submitSourceRef.current = null;

    if (!validateBasicFields()) return;

    if (formCurrency !== tripBaseCurrency && !hasValidRate) {
      setBlockingError(useCustomExchangeRate
        ? 'Enter a custom exchange rate greater than zero'
        : `No trip exchange rate set for ${formCurrency} -> ${tripBaseCurrency}. Ask admin to set it or enter a custom rate.`
      );
      setFormStepWithReason('preview', 'continue-missing-rate');
      return;
    }

    setFormError(null);
    setFormStepWithReason('preview', 'continue');
  };

  const buildSplitsList = (): ExpenseSplitInput[] | null => {
    if (formParticipants.length === 0) {
      setBlockingError('At least one participant must be selected');
      return null;
    }

    if (!hasValidConvertedAmount) {
      setBlockingError('Enter a valid amount and exchange rate first');
      return null;
    }

    if (formSplitMethod === 'equal') {
      if (!equalSplitResult.isValid) {
        setBlockingError(equalSplitResult.error ?? 'Could not calculate equal splits for this total.');
        return null;
      }
      return equalSplitResult.splits;
    }

    if (!smartCustomSplitResult.isValid) {
      setBlockingError(smartCustomSplitResult.error ?? 'Custom split amounts must match the converted expense total.');
      return null;
    }

    return smartCustomSplitResult.splits;
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const submitSource = submitSourceRef.current;

    if (formStep !== 'preview' || submitSource !== 'save-expense') {
      submitSourceRef.current = null;
      return;
    }

    if (isSaving) return;

    if (!validateBasicFields()) {
      submitSourceRef.current = null;
      return;
    }

    const amount = amountValue;
    const feeInput: ExpenseFeeInput = {
      subtotal_amount: subtotalValue,
      fee_percent: isServiceFeeEnabled ? feePercentValue : 0,
      fee_label: isServiceFeeEnabled ? (feeLabelInput.trim() || 'Service fee') : null,
    };
    const exchangeRate = activeExchangeRate;
    if (exchangeRate === null || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setBlockingError(useCustomExchangeRate
        ? 'Exchange rate must be greater than zero'
        : `No trip exchange rate set for ${formCurrency} -> ${tripBaseCurrency}. Ask admin to set it or enter a custom rate.`
      );
      setFormStepWithReason('preview', 'submit-invalid-rate');
      submitSourceRef.current = null;
      return;
    }

    const splitsList = buildSplitsList();
    if (!splitsList) {
      setFormStepWithReason('preview', 'submit-invalid-splits');
      setShowCustomizeSplit(true);
      submitSourceRef.current = null;
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
          splitsList,
          feeInput
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
          splitsList,
          feeInput
        );
      }

      closeForm();
    } catch (error) {
      console.error(error);
      setBlockingError(getBlockingErrorMessage(error, 'Could not save this expense'));
    } finally {
      submitSourceRef.current = null;
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
      setBlockingError(getBlockingErrorMessage(error, 'Could not delete this expense'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setFormParticipants(prev => {
      if (prev.includes(memberId)) {
        setFormCustomSplits(current => {
          const next = { ...current };
          delete next[memberId];
          return next;
        });
        return prev.filter(id => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const isFormOpen = isAddingExpense || Boolean(editingExpense);
  const readOnlyMessage = (trip.status ?? 'active') === 'closed'
    ? 'This trip is closed and read-only. Expenses can still be viewed, but they cannot be added, edited, or deleted.'
    : 'This trip is being closed. Cancel the close request before changing expenses.';
  const payerName = approvedMembers.find(member => member.id === formPayer)?.display_name ?? 'Unknown';
  const participantSummary = formParticipants.length === approvedMembers.length
    ? 'Everyone'
    : `${formParticipants.length} people`;
  const firstEqualSplit = equalPreviewSplits[0]?.amount_owed ?? 0;
  const customSplitTotal = smartCustomSplitResult.splits.reduce((sum, item) => sum + item.amount_owed, 0);
  const convertedTotalDisplay = hasValidConvertedAmount
    ? formatDisplayMoney(convertedAmount, tripBaseCurrency, displayCurrency, safeExchangeRates, trip.id)
    : null;
  const customSplitTotalDisplay = formatDisplayMoney(
    customSplitTotal,
    tripBaseCurrency,
    displayCurrency,
    safeExchangeRates,
    trip.id
  );
  const rateSourceText = isBaseCurrencyExpense
    ? 'Same as base currency'
    : useCustomExchangeRate
      ? activeExchangeRate
        ? `Using custom rate: 1 ${formCurrency} = ${activeExchangeRate.toString()} ${tripBaseCurrency}`
        : 'Enter a custom exchange rate'
      : tripExchangeRate
        ? `Using trip rate: 1 ${formCurrency} = ${tripExchangeRate.toString()} ${tripBaseCurrency}`
        : `No trip exchange rate set for ${formCurrency} -> ${tripBaseCurrency}`;

  return (
    <div className="flex flex-col h-full pb-20 md:pb-0 animate-fade-in relative">
      {isFormOpen ? (
        <form onSubmit={handleFormSubmit} className="flex min-h-full flex-col bg-[#121418]">
          <div className="sticky top-0 z-10 bg-[#121418]/95 backdrop-blur border-b border-slate-800 px-4 py-3 md:px-6 lg:px-8 flex items-center justify-between gap-3">
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

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5 md:px-6 lg:px-8">
            {formError && (
              <div className="mx-auto mb-4 max-w-4xl bg-[#e07a5f] border border-[#e07a5f] text-[#3d405b] p-3 rounded-2xl text-xs font-bold flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formStep === 'basic' ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    {isServiceFeeEnabled ? 'Subtotal before fee' : 'Amount'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    id="input-expense-amount"
                    value={formAmount}
                    onChange={event => {
                      const nextValue = event.target.value;
                      if (isMoneyInputValue(nextValue)) {
                        setFormAmount(nextValue);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full bg-[#1a1d23] border border-slate-800 rounded-2xl px-4 py-4 font-mono text-3xl font-bold text-white placeholder-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <section className="rounded-3xl bg-[#1a1d23] border border-slate-800 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Service fee</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Optional percentage added to this expense.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsServiceFeeEnabled(prev => {
                          const next = !prev;
                          if (!next) {
                            setFeePercentInput('');
                            setFeeLabelInput('Service fee');
                            initializeCustomSplits(formParticipants);
                          }
                          return next;
                        });
                      }}
                      className={`min-h-10 rounded-xl px-3 text-xs font-bold cursor-pointer ${
                        isServiceFeeEnabled
                          ? 'bg-[var(--color-positive)] text-slate-950'
                          : 'bg-[#121418] border border-slate-800 text-slate-300'
                      }`}
                    >
                      {isServiceFeeEnabled ? 'Remove fee' : 'Add service fee'}
                    </button>
                  </div>

                  {isServiceFeeEnabled && (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-[1fr_110px] gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Fee label
                          </label>
                          <input
                            type="text"
                            value={feeLabelInput}
                            onChange={event => setFeeLabelInput(event.target.value)}
                            placeholder="Service fee"
                            className="w-full min-h-11 bg-[#121418] border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Fee %
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={feePercentInput}
                            onChange={event => {
                              const nextValue = event.target.value;
                              if (isDecimalInputValue(nextValue)) {
                                setFeePercentInput(nextValue);
                              }
                            }}
                            placeholder="10"
                            className="w-full min-h-11 bg-[#121418] border border-slate-800 rounded-2xl px-3 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className={`rounded-2xl border px-3 py-2 text-xs ${
                        hasValidFeePercent
                          ? 'bg-[#121418] border-slate-800 text-slate-400'
                          : 'bg-[#e07a5f] border-[#e07a5f] text-[#3d405b] font-bold'
                      }`}>
                        {hasValidFeePercent ? (
                          <>
                            <p>
                              Fee: <span className="font-mono text-slate-100">{feeAmountValue.toFixed(2)} {formCurrency}</span>
                            </p>
                            <p className="mt-1">
                              Total: <span className="font-mono text-slate-100">{hasValidAmount ? amountValue.toFixed(2) : '0.00'} {formCurrency}</span>
                            </p>
                          </>
                        ) : (
                          <p>Service fee must be between 0 and 100 percent.</p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

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
                      onChange={event => setFormCurrencyWithReason(event.target.value as Currency, 'basic-currency-select')}
                      className="w-full min-h-12 bg-[#1a1d23] border border-slate-800 rounded-2xl px-3 py-3 text-sm font-bold text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                      {SUPPORTED_CURRENCIES.map(currency => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
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
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
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
                      {isServiceFeeEnabled && (
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          {hasValidAmount ? subtotalValue.toFixed(2) : '--'} + {feeAmountValue.toFixed(2)}
                        </p>
                      )}
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

                  <div className="mt-3 rounded-2xl bg-[#121418] border border-slate-800 p-3">
                    {isServiceFeeEnabled && (
                      <div className="mb-3 border-b border-slate-800 pb-3 text-[11px] text-slate-400">
                        <p className="font-mono">
                          Subtotal: <span className="text-slate-100">{hasValidAmount ? subtotalValue.toFixed(2) : '--'} {formCurrency}</span>
                        </p>
                        <p className="font-mono mt-1">
                          {(feeLabelInput.trim() || 'Service fee')} {feePercentValue || 0}%:{' '}
                          <span className="text-slate-100">{feeAmountValue.toFixed(2)} {formCurrency}</span>
                        </p>
                        <p className="font-mono mt-1">
                          Total: <span className="text-slate-100">{hasValidAmount ? amountValue.toFixed(2) : '--'} {formCurrency}</span>
                        </p>
                        {hasValidConvertedAmount && (
                          <>
                            <p className="font-mono mt-1 text-slate-500">
                              Converted subtotal: {convertedSubtotalAmount.toFixed(2)} {tripBaseCurrency}
                            </p>
                            <p className="font-mono mt-1 text-slate-500">
                              Converted fee: {convertedFeeAmount.toFixed(2)} {tripBaseCurrency}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Rate used
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${
                      !isBaseCurrencyExpense && !hasValidRate ? 'text-amber-200' : 'text-slate-100'
                    }`}>
                      {rateSourceText}
                    </p>
                    {hasValidConvertedAmount ? (
                      <p className="text-[11px] text-indigo-300 mt-1 font-mono">
                        {displayAmount.toFixed(2)} {formCurrency} = {convertedAmount.toFixed(2)} {tripBaseCurrency}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Enter a valid amount and rate to preview the converted total.
                      </p>
                    )}
                  </div>

                  <div className="mt-3 rounded-2xl bg-[#121418] border border-slate-800 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                          Split preview
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {formSplitMethod === 'equal' ? 'Equal split' : 'Custom split'} across {participantSummary.toLowerCase()}.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {tripBaseCurrency}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      {formSplitMethod === 'equal' ? (
                        equalPreviewSplits.length > 0 ? (
                          equalPreviewSplits.map(item => {
                            const member = approvedMembers.find(m => m.id === item.member_id);
                            return (
                              <div key={item.member_id} className="flex items-center justify-between text-xs text-slate-400">
                                <span>
                                  {member?.display_name ?? 'Participant'}
                                  {isServiceFeeEnabled && (
                                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                                      {item.subtotal_amount_owed?.toFixed(2) ?? '--'} + {item.fee_amount_owed?.toFixed(2) ?? '--'}
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono font-bold text-slate-100">
                                  {item.amount_owed.toFixed(2)} {tripBaseCurrency}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500">Enter a valid amount and rate to preview splits.</p>
                        )
                      ) : (
                        formParticipants.map(participantId => {
                          const member = approvedMembers.find(m => m.id === participantId);
                          const splitRow = smartCustomSplitResult.rows.find(row => row.member_id === participantId);
                          return (
                            <div key={participantId} className="flex items-center justify-between text-xs text-slate-400">
                              <span>
                                {member?.display_name ?? 'Participant'}
                                <span className="ml-1 text-[9px] uppercase">
                                  {splitRow?.mode ?? 'auto'}
                                </span>
                                {isServiceFeeEnabled && splitRow && (
                                  <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                                    {splitRow.subtotal_amount_owed?.toFixed(2) ?? '--'} + {splitRow.fee_amount_owed?.toFixed(2) ?? '--'}
                                  </span>
                                )}
                              </span>
                              <span className="font-mono font-bold text-slate-100">
                                {splitRow ? splitRow.amount_owed.toFixed(2) : '--'} {tripBaseCurrency}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </section>

                {formCurrency !== tripBaseCurrency && (
                  <section className="rounded-3xl bg-[#1a1d23] border border-slate-800 p-4">
                    {!useCustomExchangeRate && tripExchangeRate && (
                      <div>
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
                      <div>
                        <p className="text-xs text-amber-200 leading-relaxed">
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
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Custom exchange rate
                        </label>
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
                  </section>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomizeSplit(prev => !prev)}
                    className={`min-h-12 rounded-2xl border px-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${
                      showCustomizeSplit
                        ? 'bg-indigo-600 border-indigo-500 text-slate-950'
                        : 'bg-[#1a1d23] border-slate-800 text-slate-200'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Customize Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions(prev => !prev)}
                    className={`min-h-12 rounded-2xl border px-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${
                      showMoreOptions
                        ? 'bg-indigo-600 border-indigo-500 text-slate-950'
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
                          {isServiceFeeEnabled
                            ? `Enter pre-fee shares in ${tripBaseCurrency}. Parité adds the service fee automatically.`
                            : `Split amounts are in ${tripBaseCurrency}. Personal display currency is only a preview.`}
                        </p>
                      </div>
                      <button
                        type="button"
                        id="btn-split-all-match"
                        onClick={() => {
                          const allIds = approvedMembers.map(member => member.id);
                          setFormParticipants(allIds);
                          setFormCustomSplits(prev => {
                            const next: Record<string, string> = {};
                            allIds.forEach(id => {
                              next[id] = formParticipants.includes(id) ? prev[id] ?? '' : '';
                            });
                            return next;
                          });
                        }}
                        className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl cursor-pointer"
                      >
                        Select all
                      </button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
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
                        onClick={() => {
                          setFormSplitMethod('equal');
                          initializeCustomSplits(formParticipants);
                        }}
                        className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                          formSplitMethod === 'equal' ? 'bg-indigo-600 text-slate-950' : 'text-slate-400'
                        }`}
                      >
                        Equal
                      </button>
                      <button
                        type="button"
                        id="btn-split-custom"
                        onClick={() => setFormSplitMethod('custom')}
                        className={`min-h-10 rounded-xl text-xs font-bold cursor-pointer ${
                          formSplitMethod === 'custom' ? 'bg-indigo-600 text-slate-950' : 'text-slate-400'
                        }`}
                      >
                        Custom
                      </button>
                    </div>

                    {formSplitMethod === 'equal' ? (
                      <div className="grid gap-2 lg:grid-cols-2">
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              initializeCustomSplits(formParticipants);
                              setFormSplitMethod('equal');
                              setFormError(null);
                            }}
                            className="text-[10px] font-bold text-slate-200 bg-[#121418] border border-slate-800 px-3 py-2 rounded-xl cursor-pointer"
                          >
                            Reset equal split
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              initializeCustomSplits(formParticipants);
                              setFormError(null);
                            }}
                            className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl cursor-pointer"
                          >
                            Clear manual amounts
                          </button>
                        </div>
                        <div className={`rounded-2xl border px-3 py-2 text-[11px] ${
                          smartCustomSplitResult.isValid
                            ? 'bg-[#121418] border-slate-800 text-slate-500'
                            : 'bg-[#e07a5f] border-[#e07a5f] text-[#3d405b] font-bold'
                        }`}>
                          <div className="mb-2 border-b border-slate-800 pb-2">
                            <p className="font-mono text-slate-200">
                              Total: {hasValidConvertedAmount ? convertedAmount.toFixed(2) : '--'} {tripBaseCurrency}
                            </p>
                            {isServiceFeeEnabled && (
                              <>
                                <p className="font-mono text-slate-500 mt-1">
                                  Pre-fee subtotal: {Number.isFinite(convertedSubtotalAmount) ? convertedSubtotalAmount.toFixed(2) : '--'} {tripBaseCurrency}
                                </p>
                                <p className="font-mono text-slate-500 mt-1">
                                  Service fee: {Number.isFinite(convertedFeeAmount) ? convertedFeeAmount.toFixed(2) : '--'} {tripBaseCurrency}
                                </p>
                              </>
                            )}
                            {convertedTotalDisplay?.converted && (
                              <p className="font-mono text-indigo-300 mt-1">
                                {convertedTotalDisplay.primary}
                              </p>
                            )}
                            {convertedTotalDisplay?.helper && (
                              <p className="mt-1">{convertedTotalDisplay.helper}</p>
                            )}
                          </div>
                          <p>
                            Remaining {isServiceFeeEnabled ? 'pre-fee subtotal' : 'amount'} to distribute: {smartCustomSplitResult.remainingAmount.toFixed(2)} {tripBaseCurrency}
                          </p>
                          {!smartCustomSplitResult.isValid && smartCustomSplitResult.error && (
                            <p className="mt-1">{smartCustomSplitResult.error}</p>
                          )}
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {formParticipants.map(participantId => {
                            const member = approvedMembers.find(m => m.id === participantId);
                            const splitRow = smartCustomSplitResult.rows.find(row => row.member_id === participantId);
                            const manualValue = formCustomSplits[participantId] ?? '';
                            const isManual = manualValue.trim() !== '' && splitRow?.mode === 'manual';
                            const displaySplit = splitRow?.amount_owed ?? 0;
                            const displaySubtotalSplit = splitRow?.subtotal_amount_owed ?? displaySplit;
                            const displayFeeSplit = splitRow?.fee_amount_owed ?? 0;
                            const displaySplitEquivalent = formatDisplayMoney(
                              displaySplit,
                              tripBaseCurrency,
                              displayCurrency,
                              safeExchangeRates,
                              trip.id
                            );
                            return (
                              <label key={participantId} className="flex items-center justify-between gap-3 rounded-2xl bg-[#121418] border border-slate-800 px-3 py-2">
                                <span className="min-w-0">
                                  <span className="text-sm font-semibold text-slate-200 truncate block">
                                    {member?.display_name ?? 'Participant'}
                                  </span>
                                  <span className={`text-[10px] font-bold uppercase mt-1 inline-block ${
                                    isManual ? 'text-indigo-300' : 'text-slate-500'
                                  }`}>
                                    {isManual ? 'Manual' : 'Auto'}
                                  </span>
                                  {!isManual && (
                                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                      Auto {displaySubtotalSplit.toFixed(2)} {tripBaseCurrency}
                                    </span>
                                  )}
                                  {isServiceFeeEnabled && (
                                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                      +{displayFeeSplit.toFixed(2)} fee = {displaySplit.toFixed(2)} {tripBaseCurrency}
                                    </span>
                                  )}
                                  {displaySplitEquivalent.converted && (
                                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                      {displaySplit.toFixed(2)} {tripBaseCurrency} {displaySplitEquivalent.primary}
                                    </span>
                                  )}
                                </span>
                                <span className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    id={`input-custom-split-${participantId}`}
                                    value={manualValue}
                                    onChange={event => {
                                      const nextValue = event.target.value;
                                      if (isMoneyInputValue(nextValue)) {
                                        setFormCustomSplits(prev => ({
                                          ...prev,
                                          [participantId]: nextValue,
                                        }));
                                      }
                                    }}
                                    placeholder={displaySubtotalSplit.toFixed(2)}
                                    className="w-24 bg-[#1a1d23] border border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-right text-slate-100 focus:border-indigo-500 focus:outline-none"
                                  />
                                  <span className="text-[10px] font-mono text-slate-500">{tripBaseCurrency}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex justify-between border-t border-slate-800 pt-3 text-xs">
                          <span className="text-slate-500">Calculated total</span>
                          <span className="font-mono text-slate-200 text-right">
                            <span className="block">
                              {customSplitTotal.toFixed(2)}
                              {' / '}
                              {hasValidConvertedAmount ? convertedAmount.toFixed(2) : '--'} {tripBaseCurrency}
                            </span>
                            {customSplitTotalDisplay.converted && (
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                {customSplitTotalDisplay.primary}
                              </span>
                            )}
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

          <div className="shrink-0 border-t border-slate-800 bg-[#121418] p-4 md:px-6 lg:px-8 flex justify-center gap-3">
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
                  className="min-h-12 flex-[1.4] rounded-2xl bg-indigo-600 text-slate-950 font-bold text-sm cursor-pointer accent-glow"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFormStepWithReason('basic', 'back')}
                  className="min-h-12 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-300 px-4 font-bold text-sm cursor-pointer flex items-center justify-center"
                  aria-label="Back to basic fields"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  id="btn-expense-submit"
                  disabled={isSaving}
                  onClick={() => {
                    submitSourceRef.current = 'save-expense';
                  }}
                  className="min-h-12 flex-1 rounded-2xl bg-indigo-600 text-slate-950 font-bold text-sm cursor-pointer accent-glow"
                >
                  {isSaving ? 'Saving...' : editingExpense ? 'Save changes' : 'Save expense'}
                </button>
              </>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="px-4 pt-4 md:px-6 lg:px-8 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold font-display text-white tracking-tight">
                  Expenses
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {trip.name} - Base {tripBaseCurrency}
                </p>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  id="btn-add-expense-tab"
                  onClick={handleOpenAddForm}
                  className="w-12 h-12 bg-indigo-600 active:scale-95 text-slate-950 rounded-full shadow-lg transition-all flex items-center justify-center cursor-pointer accent-glow"
                  title="Add Expense"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>
              )}
            </div>

            {isReadOnly && (
              <div className="rounded-2xl border border-[#e07a5f] bg-[#e07a5f] px-4 py-3 text-xs text-[#3d405b] font-semibold leading-relaxed shadow-sm">
                {readOnlyMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#1a1d23] border border-slate-800/80 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </span>
                  <span>Your balance</span>
                </div>
                <p
                  id="user-net-balance"
                  className={`text-xl font-bold font-display leading-none ${
                    currentUserBalance && currentUserBalance.net_balance > 0.01
                      ? 'text-emerald-400'
                      : currentUserBalance && currentUserBalance.net_balance < -0.01
                        ? 'text-rose-300'
                        : 'text-slate-300'
                  }`}
                >
                  {currentUserBalance && currentUserBalance.net_balance > 0 ? '+' : ''}
                  {userBalanceDisplay.primary}
                </p>
                {userBalanceDisplay.secondary && (
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">{userBalanceDisplay.secondary}</p>
                )}
                {userBalanceDisplay.helper && (
                  <p className="text-[10px] text-slate-500 mt-1">{userBalanceDisplay.helper}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-2">{balanceLabel}</p>
              </div>

              <div className="rounded-2xl bg-[#1a1d23] border border-slate-800/80 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
                  <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </span>
                  <span>Total spent</span>
                </div>
                <p className="text-xl font-bold font-display text-white leading-none">
                  {totalSpendingDisplay.primary}
                </p>
                {totalSpendingDisplay.secondary && (
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">{totalSpendingDisplay.secondary}</p>
                )}
                {totalSpendingDisplay.helper && (
                  <p className="text-[10px] text-slate-500 mt-1">{totalSpendingDisplay.helper}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-2">{expenses.length} expenses</p>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                id="expense-search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search expenses..."
                className="w-full bg-[#1a1d23] border border-slate-800/90 rounded-2xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:outline-none text-slate-200 placeholder-slate-500"
              />
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 mt-3 no-scrollbar">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-14 px-4 border border-dashed border-slate-800 rounded-3xl bg-[#1a1d23]">
                <Search className="w-9 h-9 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-300 font-semibold">
                  {searchQuery ? 'No expenses found' : isReadOnly ? 'No expenses in this read-only trip' : 'No expenses yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {searchQuery
                    ? 'Try a different search.'
                    : isReadOnly
                      ? 'This trip is read-only, but historical expenses will appear here.'
                      : 'Tap the plus button to add the first shared cost.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-2 pb-16 md:grid-cols-2 md:pb-8 xl:grid-cols-3">
                {filteredExpenses.map(expense => {
                  const paidBy = approvedMembers.find(m => m.id === expense.paid_by_member_id);
                  const displayEquivalent = formatDisplayMoney(
                    expense.converted_amount,
                    tripBaseCurrency,
                    displayCurrency,
                    safeExchangeRates,
                    trip.id
                  );
                  const showDisplayEquivalent = displayEquivalent.converted && displayEquivalent.currency !== expense.currency;
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
                        {(expense.fee_percent ?? 0) > 0 && (
                          <span className="text-[10px] text-slate-500 mt-1 block truncate">
                            Includes {expense.fee_percent?.toString()}% {expense.fee_label || 'service fee'}
                          </span>
                        )}
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
                        {showDisplayEquivalent && (
                          <span className="text-[10px] text-slate-500 font-mono block mt-1">
                            {displayEquivalent.primary}
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end justify-center z-50 p-4 md:items-center">
          <div className="bg-[#121418] w-full max-w-sm md:max-w-xl rounded-[24px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col border border-slate-800 animate-slide-up">
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
                    {detailExpense.currency === tripBaseCurrency && detailDisplayAmount?.converted && detailDisplayAmount.currency !== detailExpense.currency && (
                      <p className="text-[10px] text-slate-500 font-mono mt-1">
                        {detailDisplayAmount.primary}
                      </p>
                    )}
                    {detailExpense.currency === tripBaseCurrency && detailDisplayAmount?.helper && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        {detailDisplayAmount.helper}
                      </p>
                    )}
                    {(detailExpense.fee_percent ?? 0) > 0 && (
                      <div className="mt-3 text-[10px] text-slate-500 font-mono leading-relaxed">
                        <p>Subtotal {(detailExpense.subtotal_amount ?? detailExpense.amount).toFixed(2)} {detailExpense.currency}</p>
                        <p>{detailExpense.fee_label || 'Service fee'} {detailExpense.fee_percent}% +{(detailExpense.fee_amount ?? 0).toFixed(2)} {detailExpense.currency}</p>
                      </div>
                    )}
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
                      {detailDisplayAmount?.converted && detailDisplayAmount.currency !== detailExpense.currency && (
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          {detailDisplayAmount.primary}
                        </p>
                      )}
                      {detailDisplayAmount?.helper && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          {detailDisplayAmount.helper}
                        </p>
                      )}
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
                          {((split.fee_amount_owed ?? 0) > 0 || (detailExpense.fee_percent ?? 0) > 0) && (
                            <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                              {(split.subtotal_amount_owed ?? split.amount_owed).toFixed(2)} + {(split.fee_amount_owed ?? 0).toFixed(2)}
                            </span>
                          )}
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
              {!isReadOnly && (currentMember.role === 'admin' || detailExpense.created_by_member_id === currentMember.id) ? (
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
                    onClick={() => {
                      setFormError(null);
                      setShowDeleteConfirm(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-[var(--color-negative)] text-slate-950 font-bold min-h-11 px-4 rounded-2xl text-sm cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center leading-normal">
                  {isReadOnly
                    ? readOnlyMessage
                    : 'Only the creator or an admin can modify this expense.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#121418] rounded-3xl p-5 shadow-2xl max-w-sm md:max-w-md w-full border border-slate-800 flex flex-col gap-4 animate-fade-in">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-negative)]/15 border border-[var(--color-negative)]/45 text-[var(--color-negative)] flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white font-display">Delete expense?</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                This will remove the expense from normal lists and recalculate balances. If this expense was already part of a paid settlement, void that settlement first.
              </p>
            </div>

            {formError && (
              <div className="bg-[#e07a5f] border border-[#e07a5f] text-[#3d405b] p-3 rounded-2xl text-xs font-bold flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

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
                className="bg-[var(--color-negative)] disabled:opacity-60 text-slate-950 font-bold min-h-11 px-4 rounded-2xl text-sm cursor-pointer"
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
