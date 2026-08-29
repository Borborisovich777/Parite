import {
  allocateEqualMinor,
  allocateProportionalMinor,
  convertAndReconcileMinorShares,
  type MinorAllocationShare,
} from './allocation';
import { MAX_EXPENSE_MINOR } from './constants';
import type {
  ReceiptAllocatedRow,
  ReceiptItemAssignment,
  ReceiptManualAdjustmentAllocation,
  ReceiptSplitError,
  ReceiptSplitRequest,
  ReceiptSplitResult,
} from './types';
import { parseReceiptExtractionResult } from './validation';

function sumMinor(values: readonly number[]): bigint {
  return values.reduce((sum, value) => sum + BigInt(value), 0n);
}

function validateMembers(memberIds: unknown): ReceiptSplitError[] {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return [{
      code: 'INVALID_MEMBER',
      message: 'At least one trip member is required to split a receipt.',
      path: 'memberIds',
    }];
  }

  const errors: ReceiptSplitError[] = [];
  const seen = new Set<string>();
  memberIds.forEach((memberId, index) => {
    if (typeof memberId !== 'string' || !memberId.trim() || memberId !== memberId.trim()) {
      errors.push({
        code: 'INVALID_MEMBER',
        message: 'Member IDs must be non-empty text without surrounding whitespace.',
        path: `memberIds[${index}]`,
      });
      return;
    }
    if (seen.has(memberId)) {
      errors.push({
        code: 'INVALID_MEMBER',
        message: `Member ID "${memberId}" is duplicated.`,
        path: `memberIds[${index}]`,
      });
    }
    seen.add(memberId);
  });
  return errors;
}

function validateAssignments(
  value: unknown,
  itemIds: ReadonlySet<string>,
  memberIds: ReadonlySet<string>
): { errors: ReceiptSplitError[]; assignments: Map<string, string[]> } {
  const errors: ReceiptSplitError[] = [];
  const assignments = new Map<string, string[]>();
  if (!Array.isArray(value)) {
    return {
      errors: [{
        code: 'INVALID_VALUE',
        message: 'Receipt item assignments must be an array.',
        path: 'itemAssignments',
      }],
      assignments,
    };
  }

  value.forEach((candidate: unknown, index) => {
    const path = `itemAssignments[${index}]`;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.push({ code: 'INVALID_VALUE', message: 'Each item assignment must be an object.', path });
      return;
    }

    const assignment = candidate as Partial<ReceiptItemAssignment>;
    const itemId = typeof assignment.itemId === 'string' ? assignment.itemId : '';
    if (!itemIds.has(itemId)) {
      errors.push({
        code: 'UNKNOWN_ASSIGNMENT',
        message: `Item assignment references unknown item "${itemId || '(missing)'}".`,
        path: `${path}.itemId`,
      });
      return;
    }
    if (assignments.has(itemId)) {
      errors.push({
        code: 'UNKNOWN_ASSIGNMENT',
        message: `Item "${itemId}" has more than one assignment row.`,
        path: `${path}.itemId`,
      });
      return;
    }
    if (!Array.isArray(assignment.memberIds) || assignment.memberIds.length === 0) {
      errors.push({
        code: 'UNASSIGNED_ITEM',
        message: `Assign item "${itemId}" to at least one member.`,
        path: `${path}.memberIds`,
      });
      assignments.set(itemId, []);
      return;
    }

    const assignedMembers: string[] = [];
    const seenMembers = new Set<string>();
    assignment.memberIds.forEach((memberId, memberIndex) => {
      if (typeof memberId !== 'string' || !memberIds.has(memberId)) {
        errors.push({
          code: 'INVALID_MEMBER',
          message: `Item "${itemId}" references a member who is not in this split.`,
          path: `${path}.memberIds[${memberIndex}]`,
        });
      } else if (seenMembers.has(memberId)) {
        errors.push({
          code: 'INVALID_MEMBER',
          message: `Item "${itemId}" assigns member "${memberId}" more than once.`,
          path: `${path}.memberIds[${memberIndex}]`,
        });
      } else {
        seenMembers.add(memberId);
        assignedMembers.push(memberId);
      }
    });
    assignments.set(itemId, assignedMembers);
  });

  itemIds.forEach(itemId => {
    if (!assignments.has(itemId)) {
      errors.push({
        code: 'UNASSIGNED_ITEM',
        message: `Assign item "${itemId}" to at least one member.`,
        path: `itemAssignments.${itemId}`,
      });
    }
  });

  return { errors, assignments };
}

function validateManualAllocations(
  value: unknown,
  manualAdjustmentIds: ReadonlySet<string>,
  memberIds: readonly string[]
): { errors: ReceiptSplitError[]; allocations: Map<string, Record<string, number>> } {
  const errors: ReceiptSplitError[] = [];
  const allocations = new Map<string, Record<string, number>>();
  if (value === undefined) value = [];
  if (!Array.isArray(value)) {
    return {
      errors: [{
        code: 'INVALID_VALUE',
        message: 'Manual adjustment allocations must be an array.',
        path: 'manualAdjustmentAllocations',
      }],
      allocations,
    };
  }

  const memberIdSet = new Set(memberIds);
  value.forEach((candidate: unknown, index) => {
    const path = `manualAdjustmentAllocations[${index}]`;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.push({ code: 'INVALID_VALUE', message: 'Each manual allocation must be an object.', path });
      return;
    }

    const allocation = candidate as Partial<ReceiptManualAdjustmentAllocation>;
    const adjustmentId = typeof allocation.adjustmentId === 'string' ? allocation.adjustmentId : '';
    if (!manualAdjustmentIds.has(adjustmentId)) {
      errors.push({
        code: 'UNKNOWN_ASSIGNMENT',
        message: `Manual allocation references unknown or non-manual adjustment "${adjustmentId || '(missing)'}".`,
        path: `${path}.adjustmentId`,
      });
      return;
    }
    if (allocations.has(adjustmentId)) {
      errors.push({
        code: 'UNKNOWN_ASSIGNMENT',
        message: `Adjustment "${adjustmentId}" has more than one manual allocation row.`,
        path: `${path}.adjustmentId`,
      });
      return;
    }
    if (
      !allocation.amountsByMemberId
      || typeof allocation.amountsByMemberId !== 'object'
      || Array.isArray(allocation.amountsByMemberId)
    ) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Manual adjustment shares must be keyed by member ID.',
        path: `${path}.amountsByMemberId`,
      });
      return;
    }

    const amounts: Record<string, number> = {};
    Object.entries(allocation.amountsByMemberId).forEach(([memberId, amount]) => {
      if (!memberIdSet.has(memberId)) {
        errors.push({
          code: 'INVALID_MEMBER',
          message: `Manual allocation references member "${memberId}" outside this split.`,
          path: `${path}.amountsByMemberId.${memberId}`,
        });
      } else if (!Number.isSafeInteger(amount) || Math.abs(amount) > MAX_EXPENSE_MINOR) {
        errors.push({
          code: 'INVALID_VALUE',
          message: 'Manual adjustment shares must use integer minor units.',
          path: `${path}.amountsByMemberId.${memberId}`,
        });
      } else {
        amounts[memberId] = amount;
      }
    });
    allocations.set(adjustmentId, amounts);
  });

  manualAdjustmentIds.forEach(adjustmentId => {
    if (!allocations.has(adjustmentId)) {
      errors.push({
        code: 'MANUAL_ADJUSTMENT_MISMATCH',
        message: `Adjustment "${adjustmentId}" needs exact manual member shares.`,
        path: `manualAdjustmentAllocations.${adjustmentId}`,
      });
    }
  });

  return { errors, allocations };
}

/**
 * Builds the canonical custom expense split from reviewed receipt rows.
 * It never mutates input and never uses floating point before base conversion.
 */
export function calculateReceiptSplits(request: ReceiptSplitRequest): ReceiptSplitResult {
  const parsedReceipt = parseReceiptExtractionResult(request.receipt);
  if (parsedReceipt.ok === false) return { ok: false, errors: parsedReceipt.errors };
  const receipt = parsedReceipt.value;
  if (!receipt.currency) {
    return {
      ok: false,
      errors: [{
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Choose a supported receipt currency before calculating the split: AED, CNY, KZT, or USD.',
        path: 'currency',
      }],
    };
  }

  const memberErrors = validateMembers(request.memberIds);
  if (memberErrors.length > 0) return { ok: false, errors: memberErrors };
  const memberIds = request.memberIds;
  const memberIdSet = new Set(memberIds);

  const itemValidation = validateAssignments(
    request.itemAssignments,
    new Set(receipt.items.map(item => item.id)),
    memberIdSet
  );
  if (itemValidation.errors.length > 0) return { ok: false, errors: itemValidation.errors };

  const manualValidation = validateManualAllocations(
    request.manualAdjustmentAllocations,
    new Set(
      receipt.adjustments
        .filter(adjustment => adjustment.allocation === 'manual')
        .map(adjustment => adjustment.id)
    ),
    memberIds
  );
  if (manualValidation.errors.length > 0) return { ok: false, errors: manualValidation.errors };

  const itemTotalMinor = sumMinor(receipt.items.map(item => item.lineTotalMinor));
  if (itemTotalMinor > BigInt(MAX_EXPENSE_MINOR)) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_VALUE',
        message: 'The combined item total is too large to calculate safely.',
        path: 'items',
      }],
    };
  }
  if (receipt.subtotalMinor !== undefined && itemTotalMinor !== BigInt(receipt.subtotalMinor)) {
    return {
      ok: false,
      errors: [{
        code: 'UNRESOLVED_DIFFERENCE',
        message: `Item totals differ from the printed subtotal by ${(BigInt(receipt.subtotalMinor) - itemTotalMinor).toString()} minor unit(s).`,
        path: 'subtotalMinor',
      }],
    };
  }

  const adjustmentTotalMinor = sumMinor(
    receipt.adjustments.map(adjustment => adjustment.amountMinor)
  );
  const absoluteAdjustmentTotalMinor = sumMinor(
    receipt.adjustments.map(adjustment => Math.abs(adjustment.amountMinor))
  );
  if (absoluteAdjustmentTotalMinor > BigInt(MAX_EXPENSE_MINOR)) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_VALUE',
        message: 'The combined adjustments are too large to calculate safely.',
        path: 'adjustments',
      }],
    };
  }
  const calculatedTotalMinor = itemTotalMinor + adjustmentTotalMinor;
  if (calculatedTotalMinor !== BigInt(receipt.totalMinor)) {
    return {
      ok: false,
      errors: [{
        code: 'UNRESOLVED_DIFFERENCE',
        message: `Items plus adjustments differ from the printed total by ${(BigInt(receipt.totalMinor) - calculatedTotalMinor).toString()} minor unit(s).`,
        path: 'totalMinor',
      }],
    };
  }

  const itemSubtotalByMember = new Map(memberIds.map(memberId => [memberId, 0]));
  const itemAllocations: ReceiptAllocatedRow[] = receipt.items.map(item => {
    const assignedMemberIds = itemValidation.assignments.get(item.id)!;
    const shares = allocateEqualMinor(item.lineTotalMinor, assignedMemberIds);
    shares.forEach(share => {
      itemSubtotalByMember.set(
        share.memberId,
        (itemSubtotalByMember.get(share.memberId) ?? 0) + share.amountMinor
      );
    });
    return { sourceId: item.id, shares };
  });

  const adjustmentMinorByMember = new Map(memberIds.map(memberId => [memberId, 0]));
  const adjustmentAllocations: ReceiptAllocatedRow[] = [];
  const adjustmentErrors: ReceiptSplitError[] = [];

  receipt.adjustments.forEach(adjustment => {
    let shares: MinorAllocationShare[] = [];
    if (adjustment.allocation === 'equal') {
      shares = allocateEqualMinor(adjustment.amountMinor, memberIds);
    } else if (adjustment.allocation === 'proportional') {
      try {
        shares = allocateProportionalMinor(
          adjustment.amountMinor,
          memberIds.map(memberId => ({
            memberId,
            weightMinor: itemSubtotalByMember.get(memberId) ?? 0,
          }))
        );
      } catch (error) {
        adjustmentErrors.push({
          code: 'UNALLOCATABLE_ADJUSTMENT',
          message: error instanceof Error
            ? `Adjustment "${adjustment.label}" cannot be allocated: ${error.message}`
            : `Adjustment "${adjustment.label}" cannot be allocated.`,
          path: `adjustments.${adjustment.id}`,
        });
        return;
      }
    } else {
      const manualAmounts = manualValidation.allocations.get(adjustment.id)!;
      shares = memberIds.map(memberId => ({
        memberId,
        amountMinor: manualAmounts[memberId] ?? 0,
      }));

      const oppositeSign = shares.some(share => (
        adjustment.amountMinor > 0
          ? share.amountMinor < 0
          : adjustment.amountMinor < 0
            ? share.amountMinor > 0
            : share.amountMinor !== 0
      ));
      const manualTotal = sumMinor(shares.map(share => share.amountMinor));
      if (oppositeSign || manualTotal !== BigInt(adjustment.amountMinor)) {
        adjustmentErrors.push({
          code: 'MANUAL_ADJUSTMENT_MISMATCH',
          message: `Manual shares for "${adjustment.label}" must use the adjustment's sign and sum exactly to ${adjustment.amountMinor} minor unit(s).`,
          path: `manualAdjustmentAllocations.${adjustment.id}`,
        });
        return;
      }
    }

    shares.forEach(share => {
      adjustmentMinorByMember.set(
        share.memberId,
        (adjustmentMinorByMember.get(share.memberId) ?? 0) + share.amountMinor
      );
    });
    adjustmentAllocations.push({ sourceId: adjustment.id, shares });
  });

  if (adjustmentErrors.length > 0) return { ok: false, errors: adjustmentErrors };

  const originalShares: MinorAllocationShare[] = memberIds.map(memberId => ({
    memberId,
    amountMinor: (itemSubtotalByMember.get(memberId) ?? 0)
      + (adjustmentMinorByMember.get(memberId) ?? 0),
  }));

  const negativeMember = originalShares.find(share => share.amountMinor < 0);
  if (negativeMember) {
    return {
      ok: false,
      errors: [{
        code: 'NEGATIVE_MEMBER_TOTAL',
        message: `Adjustments make member "${negativeMember.memberId}" owe a negative amount. Change the allocation.`,
        path: `memberShares.${negativeMember.memberId}`,
      }],
    };
  }

  if (sumMinor(originalShares.map(share => share.amountMinor)) !== BigInt(receipt.totalMinor)) {
    return {
      ok: false,
      errors: [{
        code: 'UNRESOLVED_DIFFERENCE',
        message: 'Allocated member shares do not equal the printed receipt total.',
        path: 'memberShares',
      }],
    };
  }

  let conversion: ReturnType<typeof convertAndReconcileMinorShares>;
  try {
    conversion = convertAndReconcileMinorShares(
      receipt.totalMinor,
      originalShares,
      request.exchangeRateToBase
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt conversion failed.';
    return {
      ok: false,
      errors: [{
        code: message.toLowerCase().includes('exchange rate')
          ? 'INVALID_EXCHANGE_RATE'
          : 'UNSAFE_CONVERTED_TOTAL',
        message,
        path: 'exchangeRateToBase',
      }],
    };
  }

  const convertedByMember = new Map(
    conversion.shares.map(share => [share.memberId, share.amountMinor])
  );
  const memberShares = memberIds.map(memberId => {
    const itemSubtotalMinor = itemSubtotalByMember.get(memberId) ?? 0;
    const adjustmentMinor = adjustmentMinorByMember.get(memberId) ?? 0;
    return {
      memberId,
      itemSubtotalMinor,
      adjustmentMinor,
      totalMinor: itemSubtotalMinor + adjustmentMinor,
      convertedTotalMinor: convertedByMember.get(memberId) ?? 0,
    };
  });

  return {
    ok: true,
    receipt,
    itemAllocations,
    adjustmentAllocations,
    memberShares,
    receiptTotalMinor: receipt.totalMinor,
    convertedTotalMinor: conversion.convertedTotalMinor,
    expenseSplits: memberShares.map(share => ({
      member_id: share.memberId,
      amount_owed: share.convertedTotalMinor / 100,
    })),
  };
}
