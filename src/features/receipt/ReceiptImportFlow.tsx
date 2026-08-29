import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  LoaderCircle,
  Plus,
  Receipt,
  RotateCw,
  ScanLine,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Currency, ExchangeRate, ExpenseSplitInput, Member } from '../../types';
import { SUPPORTED_CURRENCIES } from '../../types';
import { getTripExchangeRate } from '../../lib/exchangeRates';
import { parsePositiveDecimal } from '../../lib/decimalInput';
import { MemberAvatar } from '../../components/MemberAvatar';
import { allocateEqualMinor } from './allocation';
import { calculateReceiptSplits } from './calculateReceiptSplits';
import { extractReceipt } from './extractReceipt';
import { parseMoneyToMinor } from './money';
import { preprocessReceiptImage } from './preprocessReceiptImage';
import type {
  ReceiptAdjustmentAllocation,
  ReceiptAdjustmentKind,
  ReceiptExtractionResult,
  ReceiptManualAdjustmentAllocation,
  ReceiptSplitResult,
} from './types';

type ReceiptStep = 'capture' | 'extracting' | 'review' | 'assign' | 'summary';

interface EditableItem {
  id: string;
  rawName: string;
  quantity: string;
  unitAmountInput: string;
  amountInput: string;
  confidence?: number;
}

interface EditableAdjustment {
  id: string;
  kind: ReceiptAdjustmentKind;
  label: string;
  amountInput: string;
  allocation: ReceiptAdjustmentAllocation;
}

export interface ReceiptExpenseDraft {
  title: string;
  totalMinor: number;
  currency: Currency;
  expenseDate: string;
  payerId: string;
  exchangeRateToBase: number;
  rateMode: 'base' | 'group' | 'custom';
  participantIds: string[];
  baseShareMinorByMember: Record<string, number>;
  expenseSplits: ExpenseSplitInput[];
}

interface ReceiptImportFlowProps {
  isOpen: boolean;
  tripId: string;
  tripBaseCurrency: Currency;
  exchangeRates: ExchangeRate[];
  members: Member[];
  currentMember: Member;
  onClose: () => void;
  onApply: (draft: ReceiptExpenseDraft) => void;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const minorToInput = (minor: number) => (minor / 100).toFixed(2);
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const todayInputValue = () => new Date().toISOString().slice(0, 10);

const normalizeReceiptDate = (value?: string) => {
  const candidate = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!candidate) return null;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate
    ? null
    : candidate;
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Receipt processing was canceled.';
  return error instanceof Error && error.message.trim() ? error.message : fallback;
};

export const ReceiptImportFlow: React.FC<ReceiptImportFlowProps> = ({
  isOpen,
  tripId,
  tripBaseCurrency,
  exchangeRates,
  members,
  currentMember,
  onClose,
  onApply,
}) => {
  const headingId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);

  const [step, setStep] = useState<ReceiptStep>('capture');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayInputValue());
  const [currency, setCurrency] = useState<Currency>(tripBaseCurrency);
  const [subtotalInput, setSubtotalInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [excludedItems, setExcludedItems] = useState<EditableItem[]>([]);
  const [adjustments, setAdjustments] = useState<EditableAdjustment[]>([]);
  const [excludedAdjustments, setExcludedAdjustments] = useState<EditableAdjustment[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [manualAdjustmentInputs, setManualAdjustmentInputs] = useState<
    Record<string, Record<string, string>>
  >({});
  const [payerId, setPayerId] = useState(currentMember.id);
  const [customRateInput, setCustomRateInput] = useState('');
  const [splitResult, setSplitResult] = useState<Extract<ReceiptSplitResult, { ok: true }> | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [isTotalsOnlyMode, setIsTotalsOnlyMode] = useState(false);

  const groupRate = currency === tripBaseCurrency
    ? 1
    : getTripExchangeRate(exchangeRates, tripId, currency, tripBaseCurrency)?.rate ?? null;
  const parsedCustomRate = parsePositiveDecimal(customRateInput);
  const exchangeRateToBase = currency === tripBaseCurrency ? 1 : groupRate ?? parsedCustomRate;
  const rateMode: ReceiptExpenseDraft['rateMode'] = currency === tripBaseCurrency
    ? 'base'
    : groupRate
      ? 'group'
      : 'custom';

  const assignedMemberIds = useMemo(() => {
    const assigned = new Set(Object.values(assignments).flat());
    return members.filter(member => assigned.has(member.id)).map(member => member.id);
  }, [assignments, members]);

  const reviewReconciliation = useMemo(() => {
    const parsedTotal = parseMoneyToMinor(totalInput, { currency, allowZero: false });
    if ('error' in parsedTotal) return null;
    let itemTotalMinor = 0;
    for (const item of items) {
      const parsed = parseMoneyToMinor(item.amountInput, { currency, allowZero: true });
      if ('error' in parsed) return null;
      itemTotalMinor += parsed.amountMinor;
    }
    const parsedSubtotal = subtotalInput.trim()
      ? parseMoneyToMinor(subtotalInput, { currency, allowZero: true })
      : { ok: true as const, currency, amountMinor: itemTotalMinor };
    if ('error' in parsedSubtotal) return null;
    let rowsTotalMinor = itemTotalMinor;
    for (const adjustment of adjustments) {
      const parsed = parseMoneyToMinor(adjustment.amountInput, {
        currency,
        allowNegative: true,
        allowZero: true,
      });
      if ('error' in parsed) return null;
      rowsTotalMinor += parsed.amountMinor;
    }
    return {
      rowsTotalMinor,
      differenceMinor: parsedTotal.amountMinor - rowsTotalMinor,
      subtotalDifferenceMinor: parsedSubtotal.amountMinor - itemTotalMinor,
    };
  }, [adjustments, currency, items, subtotalInput, totalInput]);

  const liveItemTotals = useMemo(() => {
    const amountByMember = new Map<string, number>(
      members.map(member => [member.id, 0] as const),
    );
    let assignedCount = 0;
    for (const item of items) {
      const selected = assignments[item.id] ?? [];
      if (selected.length === 0) continue;
      const parsed = parseMoneyToMinor(item.amountInput, { currency, allowZero: true });
      if ('error' in parsed) continue;
      assignedCount += 1;
      for (const share of allocateEqualMinor(parsed.amountMinor, selected)) {
        amountByMember.set(share.memberId, (amountByMember.get(share.memberId) ?? 0) + share.amountMinor);
      }
    }
    return { amountByMember, assignedCount };
  }, [assignments, currency, items, members]);

  const clearPreviewUrl = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  };

  const startOver = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearPreviewUrl();
    setMerchant('');
    setExpenseDate(todayInputValue());
    setCurrency(tripBaseCurrency);
    setSubtotalInput('');
    setTotalInput('');
    setItems([]);
    setExcludedItems([]);
    setAdjustments([]);
    setExcludedAdjustments([]);
    setWarnings([]);
    setAssignments({});
    setManualAdjustmentInputs({});
    setCustomRateInput('');
    setSplitResult(null);
    setPreviewRotation(0);
    setIsPreviewExpanded(false);
    setIsTotalsOnlyMode(false);
    setFlowError(null);
    setStep('capture');
  };

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = (Array.from(
        dialogRef.current.querySelectorAll(focusableSelector),
      ) as HTMLElement[]).filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previous?.isConnected && previous.getClientRects().length > 0) previous.focus();
    };
  }, [isOpen]);

  const closeFlow = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearPreviewUrl();
    onClose();
  };

  const applyExtraction = (receipt: ReceiptExtractionResult) => {
    const nextCurrency = receipt.currency ?? tripBaseCurrency;
    let extractedItems = receipt.items.map(item => ({
      id: item.id,
      rawName: item.rawName,
      quantity: item.quantity ?? '',
      unitAmountInput: item.unitAmountMinor === undefined ? '' : minorToInput(item.unitAmountMinor),
      amountInput: minorToInput(item.lineTotalMinor),
      confidence: item.confidence,
    }));
    const extractedAdjustments = receipt.adjustments.map(adjustment => ({
      id: adjustment.id,
      kind: adjustment.kind,
      label: adjustment.label,
      amountInput: minorToInput(adjustment.amountMinor),
      allocation: adjustment.allocation,
    }));
    let usedTotalsOnlyFallback = false;
    let extractedItemsTotalMinor = receipt.items.reduce(
      (sum, item) => sum + item.lineTotalMinor,
      0,
    );
    if (extractedItems.length === 0) {
      const adjustmentTotal = receipt.adjustments.reduce(
        (sum, adjustment) => sum + adjustment.amountMinor,
        0,
      );
      const fallbackItemMinor = receipt.totalMinor - adjustmentTotal;
      extractedItemsTotalMinor = Math.max(0, fallbackItemMinor);
      extractedItems = [{
        id: newId('item'),
        rawName: 'Receipt total',
        quantity: '',
        unitAmountInput: '',
        amountInput: minorToInput(extractedItemsTotalMinor),
        confidence: undefined,
      }];
      usedTotalsOnlyFallback = true;
    }
    const extractedRowsTotal = extractedItemsTotalMinor
      + receipt.adjustments.reduce((sum, adjustment) => sum + adjustment.amountMinor, 0);
    const difference = receipt.totalMinor - extractedRowsTotal;
    const normalizedDate = normalizeReceiptDate(receipt.purchasedAt);

    if (difference !== 0) {
      extractedAdjustments.push({
        id: newId('adjustment'),
        kind: Math.abs(difference) <= 2 ? 'rounding' : 'other',
        label: 'Unrecognized difference',
        amountInput: minorToInput(difference),
        allocation: 'proportional',
      });
    }

    setMerchant(receipt.merchant?.trim() || 'Receipt expense');
    setExpenseDate(normalizedDate ?? todayInputValue());
    setCurrency(nextCurrency);
    setSubtotalInput(minorToInput(receipt.subtotalMinor ?? extractedItemsTotalMinor));
    setTotalInput(minorToInput(receipt.totalMinor));
    setItems(extractedItems);
    setExcludedItems([]);
    setAdjustments(extractedAdjustments);
    setExcludedAdjustments([]);
    setWarnings([
      ...receipt.warnings,
      ...(receipt.currency ? [] : ['Currency was not detected. Confirm it before continuing.']),
      ...(receipt.purchasedAt && !normalizedDate ? ['The receipt date was not usable. Confirm the date before continuing.'] : []),
      ...(usedTotalsOnlyFallback ? ['No line items were found. A totals-only row was added for manual assignment.'] : []),
      ...(difference === 0 ? [] : ['A difference row was added so the receipt reconciles. Check it carefully.']),
    ]);
    setAssignments(Object.fromEntries(extractedItems.map(item => [item.id, []])));
    setManualAdjustmentInputs({});
    setCustomRateInput('');
    setSplitResult(null);
    setPreviewRotation(0);
    setIsPreviewExpanded(false);
    setIsTotalsOnlyMode(usedTotalsOnlyFallback && extractedAdjustments.length === 0);
    setFlowError(null);
    setStep('review');
  };

  const continueWithTotalOnly = () => {
    const item: EditableItem = {
      id: newId('item'),
      rawName: 'Receipt total',
      quantity: '',
      unitAmountInput: '',
      amountInput: '',
    };
    clearPreviewUrl();
    setMerchant('Receipt expense');
    setExpenseDate(todayInputValue());
    setCurrency(tripBaseCurrency);
    setSubtotalInput('');
    setTotalInput('');
    setItems([item]);
    setExcludedItems([]);
    setAdjustments([]);
    setExcludedAdjustments([]);
    setWarnings(['Extraction was skipped. Enter the printed total and assign the totals-only row manually.']);
    setAssignments({ [item.id]: [] });
    setManualAdjustmentInputs({});
    setCustomRateInput('');
    setSplitResult(null);
    setIsTotalsOnlyMode(true);
    setFlowError(null);
    setStep('review');
  };

  const updatePrintedTotal = (value: string) => {
    setTotalInput(value);
    if (!isTotalsOnlyMode) return;
    setSubtotalInput(value);
    setItems(current => current.map((item, index) => (
      index === 0 ? { ...item, amountInput: value } : item
    )));
  };

  const handleFile = async (file: File) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setFlowError(null);
    setStep('extracting');

    try {
      const prepared = await preprocessReceiptImage(file, controller.signal);
      clearPreviewUrl();
      const nextPreviewUrl = URL.createObjectURL(prepared.blob);
      previewUrlRef.current = nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);

      const receipt = await extractReceipt({ tripId, image: prepared, signal: controller.signal });
      applyExtraction(receipt);
    } catch (error) {
      if (controller.signal.aborted) return;
      clearPreviewUrl();
      setFlowError(errorMessage(error, 'The receipt could not be prepared.'));
      setStep('capture');
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const buildReceipt = (): { ok: true; value: ReceiptExtractionResult } | { ok: false; error: string } => {
    const parsedTotal = parseMoneyToMinor(totalInput, { currency, allowZero: false });
    if ('error' in parsedTotal) return { ok: false, error: parsedTotal.error.message };
    if (items.length === 0) return { ok: false, error: 'Add at least one receipt item.' };

    const parsedItems: ReceiptExtractionResult['items'] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.rawName.trim()) return { ok: false, error: `Item ${index + 1} needs a name.` };
      const amount = parseMoneyToMinor(item.amountInput, { currency, allowZero: true });
      if ('error' in amount) return { ok: false, error: `${item.rawName || `Item ${index + 1}`}: ${amount.error.message}` };
      const unitAmount = item.unitAmountInput.trim()
        ? parseMoneyToMinor(item.unitAmountInput, { currency, allowZero: true })
        : null;
      if (unitAmount && 'error' in unitAmount) {
        return { ok: false, error: `${item.rawName || `Item ${index + 1}`} unit price: ${unitAmount.error.message}` };
      }
      parsedItems.push({
        id: item.id,
        rawName: item.rawName.trim(),
        lineTotalMinor: amount.amountMinor,
        ...(item.quantity.trim() ? { quantity: item.quantity.trim() } : {}),
        ...(unitAmount && 'amountMinor' in unitAmount ? { unitAmountMinor: unitAmount.amountMinor } : {}),
        ...(item.confidence === undefined ? {} : { confidence: item.confidence }),
      });
    }

    const parsedAdjustments: ReceiptExtractionResult['adjustments'] = [];
    for (let index = 0; index < adjustments.length; index += 1) {
      const adjustment = adjustments[index];
      if (!adjustment.label.trim()) return { ok: false, error: `Adjustment ${index + 1} needs a label.` };
      const amount = parseMoneyToMinor(adjustment.amountInput, {
        currency,
        allowNegative: true,
        allowZero: true,
      });
      if ('error' in amount) return { ok: false, error: `${adjustment.label}: ${amount.error.message}` };
      parsedAdjustments.push({
        id: adjustment.id,
        kind: adjustment.kind,
        label: adjustment.label.trim(),
        amountMinor: amount.amountMinor,
        allocation: adjustment.allocation,
      });
    }

    const calculatedSubtotalMinor = parsedItems.reduce((sum, item) => sum + item.lineTotalMinor, 0);
    const parsedSubtotal = subtotalInput.trim()
      ? parseMoneyToMinor(subtotalInput, { currency, allowZero: true })
      : { ok: true as const, currency, amountMinor: calculatedSubtotalMinor };
    if ('error' in parsedSubtotal) return { ok: false, error: `Printed subtotal: ${parsedSubtotal.error.message}` };
    if (parsedSubtotal.amountMinor !== calculatedSubtotalMinor) {
      return {
        ok: false,
        error: `Item rows differ from the printed subtotal by ${minorToInput(parsedSubtotal.amountMinor - calculatedSubtotalMinor)} ${currency}.`,
      };
    }
    const subtotalMinor = parsedSubtotal.amountMinor;
    const rowsTotalMinor = subtotalMinor
      + parsedAdjustments.reduce((sum, adjustment) => sum + adjustment.amountMinor, 0);
    if (rowsTotalMinor !== parsedTotal.amountMinor) {
      return {
        ok: false,
        error: `Items and adjustments differ from the receipt total by ${minorToInput(parsedTotal.amountMinor - rowsTotalMinor)} ${currency}.`,
      };
    }

    return {
      ok: true,
      value: {
        merchant: merchant.trim() || 'Receipt expense',
        purchasedAt: expenseDate,
        currency,
        subtotalMinor,
        totalMinor: parsedTotal.amountMinor,
        items: parsedItems,
        adjustments: parsedAdjustments,
        warnings,
      },
    };
  };

  const addDifferenceAdjustment = () => {
    const parsedTotal = parseMoneyToMinor(totalInput, { currency, allowZero: false });
    if ('error' in parsedTotal) {
      setFlowError(parsedTotal.error.message);
      return;
    }
    let rowsTotal = 0;
    for (const item of items) {
      const parsed = parseMoneyToMinor(item.amountInput, { currency, allowZero: true });
      if ('error' in parsed) return setFlowError(`${item.rawName}: ${parsed.error.message}`);
      rowsTotal += parsed.amountMinor;
    }
    for (const adjustment of adjustments) {
      const parsed = parseMoneyToMinor(adjustment.amountInput, { currency, allowNegative: true, allowZero: true });
      if ('error' in parsed) return setFlowError(`${adjustment.label}: ${parsed.error.message}`);
      rowsTotal += parsed.amountMinor;
    }
    const difference = parsedTotal.amountMinor - rowsTotal;
    if (difference === 0) {
      setFlowError(null);
      return;
    }
    setAdjustments(current => [...current, {
      id: newId('adjustment'),
      kind: Math.abs(difference) <= 2 ? 'rounding' : 'other',
      label: 'Unrecognized difference',
      amountInput: minorToInput(difference),
      allocation: 'proportional',
    }]);
    setFlowError(null);
  };

  const continueToAssignment = () => {
    const receipt = buildReceipt();
    if ('error' in receipt) {
      setFlowError(receipt.error);
      return;
    }
    setFlowError(null);
    setStep('assign');
  };

  const toggleAssignment = (itemId: string, memberId: string) => {
    setAssignments(current => {
      const assigned = current[itemId] ?? [];
      return {
        ...current,
        [itemId]: assigned.includes(memberId)
          ? assigned.filter(id => id !== memberId)
          : [...assigned, memberId],
      };
    });
    setSplitResult(null);
  };

  const assignEveryItem = (memberIds: string[]) => {
    setAssignments(Object.fromEntries(items.map(item => [item.id, [...memberIds]])));
    setSplitResult(null);
  };

  const buildManualAllocations = (
    activeMembers: string[],
  ): { ok: true; value: ReceiptManualAdjustmentAllocation[] } | { ok: false; error: string } => {
    const value: ReceiptManualAdjustmentAllocation[] = [];
    for (const adjustment of adjustments.filter(row => row.allocation === 'manual')) {
      const amountsByMemberId: Record<string, number> = {};
      for (const memberId of activeMembers) {
        const input = manualAdjustmentInputs[adjustment.id]?.[memberId] ?? '0.00';
        const parsed = parseMoneyToMinor(input, { currency, allowNegative: true, allowZero: true });
        if ('error' in parsed) return { ok: false, error: `${adjustment.label}: ${parsed.error.message}` };
        amountsByMemberId[memberId] = parsed.amountMinor;
      }
      value.push({ adjustmentId: adjustment.id, amountsByMemberId });
    }
    return { ok: true, value };
  };

  const continueToSummary = () => {
    const receipt = buildReceipt();
    if ('error' in receipt) return setFlowError(receipt.error);
    const unassigned = receipt.value.items.find(item => (assignments[item.id] ?? []).length === 0);
    if (unassigned) return setFlowError(`Assign “${unassigned.rawName}” to at least one person.`);
    if (assignedMemberIds.length === 0) return setFlowError('Assign at least one receipt item.');
    if (exchangeRateToBase === null) {
      return setFlowError(`Enter an exchange rate from ${currency} to ${tripBaseCurrency}.`);
    }

    const manualAllocations = buildManualAllocations(assignedMemberIds);
    if ('error' in manualAllocations) return setFlowError(manualAllocations.error);
    const result = calculateReceiptSplits({
      receipt: receipt.value,
      memberIds: assignedMemberIds,
      itemAssignments: receipt.value.items.map(item => ({
        itemId: item.id,
        memberIds: assignments[item.id] ?? [],
      })),
      manualAdjustmentAllocations: manualAllocations.value,
      exchangeRateToBase,
    });
    if ('errors' in result) return setFlowError(result.errors[0]?.message ?? 'The receipt split could not be calculated.');

    setSplitResult(result);
    setFlowError(null);
    setStep('summary');
  };

  const applyDraft = () => {
    if (!splitResult || exchangeRateToBase === null) return;
    const participantIds = splitResult.memberShares.map(share => share.memberId);
    onApply({
      title: merchant.trim() || 'Receipt expense',
      totalMinor: splitResult.receiptTotalMinor,
      currency,
      expenseDate,
      payerId,
      exchangeRateToBase,
      rateMode,
      participantIds,
      baseShareMinorByMember: Object.fromEntries(
        splitResult.memberShares.map(share => [share.memberId, share.convertedTotalMinor]),
      ),
      expenseSplits: splitResult.expenseSplits,
    });
  };

  const stepTitle = {
    capture: 'Scan receipt',
    extracting: 'Reading receipt',
    review: 'Check receipt',
    assign: 'Assign items',
    summary: 'Review split',
  }[step];
  const stepDescription = {
    capture: 'The photo is processed once and is never saved by Parité.',
    extracting: 'Preparing the image and reading item rows.',
    review: 'Correct anything the receipt reader missed.',
    assign: 'Choose who shared each item.',
    summary: 'Confirm exact totals before returning to the expense.',
  }[step];

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-stretch justify-center bg-slate-950/35 backdrop-blur-[2px] md:p-6">
      <div
        ref={dialogRef}
        className="parite-shell flex h-[100dvh] min-h-0 w-full max-w-md flex-col bg-[#f5f7f4] font-sans md:h-[calc(100dvh-3rem)] md:max-w-4xl md:overflow-hidden md:rounded-[36px] md:border md:border-black/10 md:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
      <header
        className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-white/95 px-4 pb-3 pt-3 backdrop-blur md:px-6"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeFlow}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-slate-600 transition active:scale-95"
          aria-label="Close receipt import"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <h2 id={headingId} className="font-display text-sm font-bold text-slate-900">{stepTitle}</h2>
          <p id={descriptionId} className="mt-0.5 text-[10px] text-slate-500">{stepDescription}</p>
        </div>
        <div className="flex h-10 min-w-10 items-center justify-end text-[10px] font-bold text-slate-500">
          {step === 'capture' || step === 'extracting' ? '1 / 4' : step === 'review' ? '2 / 4' : step === 'assign' ? '3 / 4' : '4 / 4'}
        </div>
      </header>

      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {flowError && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl border border-[#e07a5f] bg-[#fbe7e1] p-3 text-xs font-bold text-[#8f402f]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{flowError}</span>
            </div>
          )}

          <div className="sr-only" aria-live="polite">
            {step === 'extracting' ? 'Reading receipt.' : `${stepTitle}. ${flowError ?? ''}`}
          </div>

          {step === 'capture' && (
            <section className="rounded-[28px] border border-black/10 bg-white p-5 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#e7f3ee] text-[#2f7d66]">
                <ScanLine className="h-8 w-8" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-slate-900">Turn a receipt into item rows</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                Use a clear, straight photo. You will check every amount and decide who shared each item.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#81b29a] px-4 text-sm font-bold text-[#16372b]"
                >
                  <Camera className="h-5 w-5" />
                  Take or choose photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-[#f7f8f5] px-4 text-sm font-bold text-slate-700"
                >
                  <Upload className="h-5 w-5" />
                  Browse files
                </button>
              </div>
              <button
                type="button"
                onClick={continueWithTotalOnly}
                className="mt-3 min-h-11 w-full rounded-2xl border border-dashed border-black/15 bg-white px-4 text-xs font-bold text-slate-600"
              >
                Skip extraction and enter a total only
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                aria-label="Take a receipt photo"
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void handleFile(file);
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose a receipt image file"
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void handleFile(file);
                }}
              />
              <div className="mt-5 grid grid-cols-3 gap-2 text-left text-[11px] text-slate-600">
                <div className="rounded-2xl bg-[#f7f8f5] p-3"><strong className="block text-slate-800">No storage</strong>Image bytes are discarded.</div>
                <div className="rounded-2xl bg-[#f7f8f5] p-3"><strong className="block text-slate-800">You decide</strong>No automatic ownership.</div>
                <div className="rounded-2xl bg-[#f7f8f5] p-3"><strong className="block text-slate-800">Exact cents</strong>Totals must reconcile.</div>
              </div>
            </section>
          )}

          {step === 'extracting' && (
            <section className="rounded-[28px] border border-black/10 bg-white p-5 text-center shadow-sm">
              {previewUrl ? (
                <img src={previewUrl} alt="Receipt being processed" className="mx-auto max-h-[52vh] w-full rounded-2xl border border-black/10 object-contain" />
              ) : (
                <div className="mx-auto flex h-48 items-center justify-center rounded-2xl bg-[#eef4f1]">
                  <Receipt className="h-12 w-12 text-[#4fa889]" />
                </div>
              )}
              <div className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-slate-800">
                <LoaderCircle className="h-5 w-5 animate-spin text-[#2f7d66]" />
                Reading item names and prices…
              </div>
              <p className="mt-2 text-xs text-slate-500">Keep this screen open. Manual entry remains available if reading fails.</p>
            </section>
          )}

          {step === 'review' && (
            <>
              {previewUrl && (
                <section className="rounded-[24px] border border-black/10 bg-white p-2 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <p className="text-[11px] font-semibold text-slate-600">Receipt photo</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewRotation(current => (current + 90) % 360)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-[#f7f8f5] text-slate-600"
                        aria-label="Rotate receipt photo 90 degrees"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPreviewExpanded(current => !current)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-[#f7f8f5] text-slate-600"
                        aria-label={isPreviewExpanded ? 'Reduce receipt photo' : 'Enlarge receipt photo'}
                        aria-pressed={isPreviewExpanded}
                      >
                        {isPreviewExpanded ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex max-h-[72vh] items-center justify-center overflow-auto rounded-[18px] bg-[#f7f8f5] p-2">
                    <img
                      src={previewUrl}
                      alt="Receipt preview for review"
                      className={`${isPreviewExpanded ? 'max-h-[68vh]' : 'max-h-64'} w-full object-contain transition-[max-height,transform] duration-200`}
                      style={{ transform: `rotate(${previewRotation}deg)` }}
                    />
                  </div>
                </section>
              )}

              {warnings.length > 0 && (
                <section className="rounded-[24px] border border-[#e8b65c]/50 bg-[#fff7df] p-4 text-xs text-[#6b4b16]">
                  <div className="flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" />Needs check</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
                </section>
              )}

              <section className="grid gap-3 rounded-[24px] border border-black/10 bg-white p-4 shadow-sm md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600 md:col-span-2">
                  Merchant or title
                  <input value={merchant} onChange={event => setMerchant(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-black/10 bg-[#f7f8f5] px-4 text-sm text-slate-900" />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Date
                  <input type="date" value={expenseDate} onChange={event => setExpenseDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-black/10 bg-[#f7f8f5] px-4 text-sm text-slate-900" />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Printed subtotal
                  <input inputMode="decimal" value={subtotalInput} onChange={event => setSubtotalInput(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-black/10 bg-[#f7f8f5] px-4 text-right font-mono text-sm text-slate-900" />
                </label>
                <div className="grid grid-cols-[96px_1fr] gap-3 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Currency
                    <select value={currency} onChange={event => { setCurrency(event.target.value as Currency); setSplitResult(null); }} className="mt-2 min-h-12 w-full rounded-2xl border border-black/10 bg-[#f7f8f5] px-3 text-sm font-bold text-slate-900">
                      {SUPPORTED_CURRENCIES.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Printed total
                    <input inputMode="decimal" value={totalInput} onChange={event => updatePrintedTotal(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-black/10 bg-[#f7f8f5] px-4 text-right font-mono text-sm font-bold text-slate-900" />
                  </label>
                </div>
              </section>

              <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-slate-900">Items</h3><p className="mt-0.5 text-[11px] text-slate-500">Keep repeated names as separate rows.</p></div>
                  <button type="button" onClick={() => { setIsTotalsOnlyMode(false); setItems(current => [...current, { id: newId('item'), rawName: '', quantity: '', unitAmountInput: '', amountInput: '' }]); }} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-[#f7f8f5] px-3 text-xs font-bold text-slate-700"><Plus className="h-4 w-4" />Add item</button>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {items.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-black/10 bg-[#f7f8f5] p-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_96px_44px] gap-2">
                        <label className="text-[10px] font-semibold text-slate-500">Item {index + 1}<input value={item.rawName} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, rawName: event.target.value } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-slate-900" aria-label={`Item ${index + 1} name`} /></label>
                        <label className="text-[10px] font-semibold text-slate-500">Amount<input inputMode="decimal" value={item.amountInput} onChange={event => { setIsTotalsOnlyMode(false); setItems(current => current.map(row => row.id === item.id ? { ...row, amountInput: event.target.value } : row)); }} className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-right font-mono text-sm text-slate-900" aria-label={`Item ${index + 1} amount`} /></label>
                        <button type="button" onClick={() => { setItems(current => current.filter(row => row.id !== item.id)); setExcludedItems(current => [...current, item]); setAssignments(current => { const next = { ...current }; delete next[item.id]; return next; }); }} className="mt-[18px] flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white text-slate-500" aria-label={`Exclude item ${index + 1}: ${item.rawName || 'unnamed'}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="block text-[10px] font-semibold text-slate-500">Quantity (optional)<input value={item.quantity} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, quantity: event.target.value } : row))} placeholder="1" className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 font-mono text-xs text-slate-900" aria-label={`Item ${index + 1} quantity`} /></label>
                        <label className="block text-[10px] font-semibold text-slate-500">Unit price (optional)<input inputMode="decimal" value={item.unitAmountInput} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, unitAmountInput: event.target.value } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-right font-mono text-xs text-slate-900" aria-label={`Item ${index + 1} unit price`} /></label>
                      </div>
                      {item.confidence !== undefined && item.confidence < 0.85 && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#8f402f]"><AlertCircle className="h-3.5 w-3.5" />Needs check</p>}
                    </div>
                  ))}
                </div>
                {excludedItems.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-[#f7f8f5] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Excluded items</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {excludedItems.map(item => (
                        <div key={item.id} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-xs text-slate-600">
                          <span className="min-w-0 flex-1 truncate">{item.rawName || 'Unnamed item'}</span>
                          <span className="font-mono">{item.amountInput || '0.00'}</span>
                          <button
                            type="button"
                            onClick={() => { setExcludedItems(current => current.filter(row => row.id !== item.id)); setItems(current => [...current, item]); setAssignments(current => ({ ...current, [item.id]: [] })); }}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 text-slate-600"
                            aria-label={`Restore ${item.rawName || 'unnamed item'}`}
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-slate-900">Tax, fees and discounts</h3><p className="mt-0.5 text-[11px] text-slate-500">These are already inside the printed total.</p></div>
                  <button type="button" onClick={() => setAdjustments(current => [...current, { id: newId('adjustment'), kind: 'other', label: '', amountInput: '', allocation: 'proportional' }])} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-[#f7f8f5] px-3 text-xs font-bold text-slate-700"><Plus className="h-4 w-4" />Add</button>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {adjustments.length === 0 && <p className="rounded-2xl bg-[#f7f8f5] p-3 text-xs text-slate-500">No receipt-level adjustments found.</p>}
                  {adjustments.map((adjustment, index) => (
                    <div key={adjustment.id} className="grid grid-cols-[minmax(0,1fr)_88px_44px] gap-2 rounded-2xl border border-black/10 bg-[#f7f8f5] p-3">
                      <div className="grid gap-2 sm:grid-cols-[112px_minmax(0,1fr)_124px]">
                        <select value={adjustment.kind} onChange={event => setAdjustments(current => current.map(row => row.id === adjustment.id ? { ...row, kind: event.target.value as ReceiptAdjustmentKind } : row))} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-slate-700" aria-label={`${adjustment.label || `Adjustment ${index + 1}`} type`}><option value="tax">Tax</option><option value="tip">Tip</option><option value="service">Service</option><option value="discount">Discount</option><option value="rounding">Rounding</option><option value="other">Other</option></select>
                        <input value={adjustment.label} onChange={event => setAdjustments(current => current.map(row => row.id === adjustment.id ? { ...row, label: event.target.value } : row))} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-slate-900" aria-label={`Adjustment ${index + 1} label`} />
                        <select value={adjustment.allocation} onChange={event => setAdjustments(current => current.map(row => row.id === adjustment.id ? { ...row, allocation: event.target.value as ReceiptAdjustmentAllocation } : row))} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-slate-700" aria-label={`${adjustment.label || `Adjustment ${index + 1}`} allocation`}><option value="proportional">Proportional</option><option value="equal">Equal</option><option value="manual">Manual</option></select>
                      </div>
                      <input inputMode="decimal" value={adjustment.amountInput} onChange={event => setAdjustments(current => current.map(row => row.id === adjustment.id ? { ...row, amountInput: event.target.value } : row))} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-right font-mono text-sm text-slate-900" aria-label={`${adjustment.label || `Adjustment ${index + 1}`} amount`} />
                      <button type="button" onClick={() => { setAdjustments(current => current.filter(row => row.id !== adjustment.id)); setExcludedAdjustments(current => [...current, adjustment]); }} className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white text-slate-500" aria-label={`Exclude ${adjustment.label || `adjustment ${index + 1}`}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                {excludedAdjustments.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-[#f7f8f5] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Excluded adjustments</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {excludedAdjustments.map(adjustment => (
                        <div key={adjustment.id} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-xs text-slate-600">
                          <span className="min-w-0 flex-1 truncate">{adjustment.label || 'Unnamed adjustment'}</span>
                          <span className="font-mono">{adjustment.amountInput || '0.00'}</span>
                          <button
                            type="button"
                            onClick={() => { setExcludedAdjustments(current => current.filter(row => row.id !== adjustment.id)); setAdjustments(current => [...current, adjustment]); }}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 text-slate-600"
                            aria-label={`Restore ${adjustment.label || 'unnamed adjustment'}`}
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" onClick={addDifferenceAdjustment} className="mt-3 min-h-11 w-full rounded-xl border border-dashed border-[#81b29a] bg-[#eef8f3] px-3 text-xs font-bold text-[#2f7d66]">Add any remaining difference</button>
              </section>

              <section
                aria-live="polite"
                className={`rounded-[24px] border p-4 text-xs ${reviewReconciliation?.differenceMinor === 0 && reviewReconciliation.subtotalDifferenceMinor === 0 ? 'border-[#81b29a]/50 bg-[#e7f3ee] text-[#275f4f]' : 'border-[#e8b65c]/50 bg-[#fff7df] text-[#6b4b16]'}`}
              >
                <div className="flex items-center justify-between gap-3 font-bold">
                  <span>Receipt reconciliation</span>
                  <span className="font-mono">
                    {reviewReconciliation
                      ? `${minorToInput(reviewReconciliation.rowsTotalMinor)} / ${totalInput || '—'} ${currency}`
                      : 'Check entered values'}
                  </span>
                </div>
                <p className="mt-1">
                  {reviewReconciliation && reviewReconciliation.subtotalDifferenceMinor !== 0
                    ? `Resolve the ${minorToInput(reviewReconciliation.subtotalDifferenceMinor)} ${currency} item-to-subtotal difference before assigning items.`
                    : reviewReconciliation?.differenceMinor === 0
                    ? 'Items and adjustments match the printed total exactly.'
                    : reviewReconciliation
                      ? `Resolve the ${minorToInput(reviewReconciliation.differenceMinor)} ${currency} difference before assigning items.`
                      : 'Enter valid item, adjustment, subtotal, and total values.'}
                </p>
              </section>
            </>
          )}

          {step === 'assign' && (
            <>
              <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold text-slate-900">Quick assignment</h3><p className="mt-0.5 text-[11px] text-slate-500">You can still change individual rows.</p></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => assignEveryItem([payerId])} className="min-h-11 rounded-xl border border-black/10 bg-[#e7f3ee] px-3 text-xs font-bold text-[#2f7d66]">All to payer</button>
                    <button type="button" onClick={() => assignEveryItem(members.map(member => member.id))} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-[#e8f1fa] px-3 text-xs font-bold text-slate-700"><Users className="h-4 w-4" />Everyone</button>
                  </div>
                </div>
              </section>

              <section aria-live="polite" className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Live item totals</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">{liveItemTotals.assignedCount} of {items.length} items assigned</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${liveItemTotals.assignedCount === items.length ? 'bg-[#e7f3ee] text-[#2f7d66]' : 'bg-[#fff1d7] text-[#7b5719]'}`}>
                    {liveItemTotals.assignedCount === items.length ? 'Ready' : 'Incomplete'}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {members.map(member => (
                    <div key={member.id} className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#f7f8f5] px-3">
                      <MemberAvatar member={member} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{member.display_name}</span>
                      <span className="font-mono text-xs font-bold text-slate-900">{minorToInput(liveItemTotals.amountByMember.get(member.id) ?? 0)} {currency}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">Receipt-level adjustments are added on the final review.</p>
              </section>

              {items.map((item, index) => (
                <section key={item.id} className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item {index + 1}</p><h3 className="mt-1 truncate text-sm font-bold text-slate-900">{item.rawName}</h3></div>
                    <p className="shrink-0 font-mono text-sm font-bold text-slate-900">{item.amountInput} {currency}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {members.map(member => {
                      const selected = (assignments[item.id] ?? []).includes(member.id);
                      return <button key={member.id} type="button" aria-pressed={selected} aria-label={`${selected ? 'Remove' : 'Assign'} ${item.rawName} ${selected ? 'from' : 'to'} ${member.display_name}`} onClick={() => toggleAssignment(item.id, member.id)} className={`flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-xs font-bold transition ${selected ? 'border-[#81b29a] bg-[#e7f3ee] text-[#2f7d66]' : 'border-black/10 bg-[#f7f8f5] text-slate-700'}`}><MemberAvatar member={member} size="xs" /><span>{member.id === currentMember.id ? 'You' : member.display_name}</span>{selected && <Check className="h-3.5 w-3.5" />}</button>;
                    })}
                  </div>
                </section>
              ))}

              {adjustments.some(adjustment => adjustment.allocation === 'manual') && assignedMemberIds.length > 0 && (
                <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Manual adjustment shares</h3>
                  <p className="mt-1 text-[11px] text-slate-500">Each row must add up exactly to its adjustment.</p>
                  <div className="mt-4 flex flex-col gap-4">
                    {adjustments.filter(adjustment => adjustment.allocation === 'manual').map(adjustment => (
                      <div key={adjustment.id} className="rounded-2xl bg-[#f7f8f5] p-3">
                        <div className="flex justify-between gap-3 text-xs font-bold text-slate-800"><span>{adjustment.label}</span><span className="font-mono">{adjustment.amountInput} {currency}</span></div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {members.filter(member => assignedMemberIds.includes(member.id)).map(member => <label key={member.id} className="flex items-center gap-2 text-xs text-slate-600"><MemberAvatar member={member} size="xs" /><span className="min-w-0 flex-1 truncate">{member.display_name}</span><input inputMode="decimal" value={manualAdjustmentInputs[adjustment.id]?.[member.id] ?? ''} onChange={event => setManualAdjustmentInputs(current => ({ ...current, [adjustment.id]: { ...(current[adjustment.id] ?? {}), [member.id]: event.target.value } }))} placeholder="0.00" className="min-h-11 w-24 rounded-xl border border-black/10 bg-white px-3 text-right font-mono text-xs text-slate-900" aria-label={`${adjustment.label} share for ${member.display_name}`} /></label>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {currency !== tripBaseCurrency && (
                <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">Exchange rate</h3>
                  {groupRate ? <p className="mt-2 rounded-2xl bg-[#e7f3ee] p-3 text-xs text-slate-700">Using group rate: 1 {currency} = <strong className="font-mono">{groupRate} {tripBaseCurrency}</strong></p> : <label className="mt-3 block text-xs font-semibold text-slate-600">1 {currency} equals<input inputMode="decimal" value={customRateInput} onChange={event => { setCustomRateInput(event.target.value); setSplitResult(null); }} placeholder={`Amount in ${tripBaseCurrency}`} className="mt-2 min-h-12 w-full rounded-2xl border border-black/10 bg-[#f7f8f5] px-4 font-mono text-sm text-slate-900" /></label>}
                </section>
              )}
            </>
          )}

          {step === 'summary' && splitResult && (
            <>
              <section className="rounded-[28px] border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Receipt total</p>
                <div className="mt-2 flex items-end justify-between gap-3"><div><h3 className="font-display text-xl font-bold text-slate-900">{merchant || 'Receipt expense'}</h3><p className="mt-1 text-xs text-slate-500">{expenseDate} · {rateMode === 'custom' ? 'Custom exchange rate' : rateMode === 'group' ? 'Group exchange rate' : 'Base currency'}</p></div><p className="font-mono text-xl font-bold text-slate-900">{minorToInput(splitResult.receiptTotalMinor)} {currency}</p></div>
              </section>

              <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                <label className="block text-xs font-semibold text-slate-600">Paid by<select value={payerId} onChange={event => setPayerId(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-black/10 bg-[#f7f8f5] px-4 text-sm text-slate-900">{members.map(member => <option key={member.id} value={member.id}>{member.display_name}{member.id === currentMember.id ? ' (You)' : ''}</option>)}</select></label>
              </section>

              <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Who owes what</h3>
                <div className="mt-3 flex flex-col gap-2">
                  {splitResult.memberShares.map(share => {
                    const member = members.find(candidate => candidate.id === share.memberId);
                    if (!member) return null;
                    return <div key={share.memberId} className="flex items-center gap-3 rounded-2xl bg-[#f7f8f5] p-3"><MemberAvatar member={member} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{member.display_name}{member.id === currentMember.id ? ' (You)' : ''}</p><p className="mt-0.5 text-[10px] text-slate-500">Items {minorToInput(share.itemSubtotalMinor)} · adjustments {minorToInput(share.adjustmentMinor)} {currency}</p></div><div className="text-right"><p className="font-mono text-sm font-bold text-slate-900">{minorToInput(share.convertedTotalMinor)} {tripBaseCurrency}</p>{currency !== tripBaseCurrency && <p className="mt-0.5 font-mono text-[10px] text-slate-500">{minorToInput(share.totalMinor)} {currency}</p>}</div></div>;
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 text-xs"><span className="font-semibold text-slate-500">Converted total</span><span className="font-mono font-bold text-slate-900">{minorToInput(splitResult.convertedTotalMinor)} {tripBaseCurrency}</span></div>
              </section>
            </>
          )}
        </div>
      </main>

      <footer className="flex shrink-0 justify-center gap-3 border-t border-black/10 bg-white p-4 md:px-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {step === 'capture' && <button type="button" onClick={closeFlow} className="min-h-12 flex-1 rounded-2xl border border-black/10 bg-[#f7f8f5] text-sm font-bold text-slate-700">Cancel</button>}
        {step === 'extracting' && <button type="button" onClick={startOver} className="min-h-12 flex-1 rounded-2xl border border-black/10 bg-[#f7f8f5] text-sm font-bold text-slate-700">Cancel reading</button>}
        {step === 'review' && <><button type="button" onClick={startOver} className="flex min-h-12 w-14 items-center justify-center rounded-2xl border border-black/10 bg-[#f7f8f5] text-slate-700" aria-label="Choose another receipt"><ArrowLeft className="h-4 w-4" /></button><button type="button" onClick={continueToAssignment} className="min-h-12 flex-1 rounded-2xl bg-[#81b29a] px-4 text-sm font-bold text-[#16372b]">Assign items</button></>}
        {step === 'assign' && <><button type="button" onClick={() => { setFlowError(null); setStep('review'); }} className="flex min-h-12 w-14 items-center justify-center rounded-2xl border border-black/10 bg-[#f7f8f5] text-slate-700" aria-label="Back to receipt review"><ArrowLeft className="h-4 w-4" /></button><button type="button" onClick={continueToSummary} className="min-h-12 flex-1 rounded-2xl bg-[#81b29a] px-4 text-sm font-bold text-[#16372b]">Review split</button></>}
        {step === 'summary' && <><button type="button" onClick={() => { setFlowError(null); setStep('assign'); }} className="flex min-h-12 w-14 items-center justify-center rounded-2xl border border-black/10 bg-[#f7f8f5] text-slate-700" aria-label="Back to assignments"><ArrowLeft className="h-4 w-4" /></button><button type="button" onClick={applyDraft} className="min-h-12 flex-1 rounded-2xl bg-[#81b29a] px-4 text-sm font-bold text-[#16372b]">Use this split</button></>}
        </footer>
      </div>
    </div>,
    document.body,
  );
};
