import { calculateConvertedAmount } from '../../lib/calculations';
import { MAX_EXPENSE_MINOR } from './constants';

export interface MinorAllocationShare {
  memberId: string;
  amountMinor: number;
}

function assertSafeMinor(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_EXPENSE_MINOR) {
    throw new RangeError(`${name} exceeds Parité's supported expense range.`);
  }
}

function assertUniqueMemberIds(memberIds: readonly string[]): void {
  if (memberIds.length === 0) {
    throw new RangeError('At least one member is required for allocation.');
  }

  if (memberIds.some(memberId => !memberId.trim())) {
    throw new RangeError('Member IDs cannot be empty.');
  }

  if (new Set(memberIds).size !== memberIds.length) {
    throw new RangeError('Member IDs must be unique.');
  }
}

/**
 * Splits a signed integer amount equally. Remainder units go to the earliest
 * members in the supplied stable order (10.00 / 3 => 3.34, 3.33, 3.33).
 */
export function allocateEqualMinor(
  amountMinor: number,
  memberIds: readonly string[]
): MinorAllocationShare[] {
  assertSafeMinor(amountMinor, 'Amount');
  assertUniqueMemberIds(memberIds);

  const sign = amountMinor < 0 ? -1 : 1;
  const absoluteAmount = Math.abs(amountMinor);
  const base = Math.floor(absoluteAmount / memberIds.length);
  const remainder = absoluteAmount - (base * memberIds.length);

  return memberIds.map((memberId, index) => ({
    memberId,
    amountMinor: base === 0 && index >= remainder
      ? 0
      : sign * (base + (index < remainder ? 1 : 0)),
  }));
}

/**
 * Allocates a signed amount with the largest-remainder method. Zero-weight
 * members stay at zero; equal fractional remainders follow input order.
 */
export function allocateProportionalMinor(
  amountMinor: number,
  weights: ReadonlyArray<{ memberId: string; weightMinor: number }>
): MinorAllocationShare[] {
  assertSafeMinor(amountMinor, 'Amount');
  assertUniqueMemberIds(weights.map(weight => weight.memberId));
  weights.forEach(({ weightMinor }) => {
    assertSafeMinor(weightMinor, 'Allocation weight');
    if (weightMinor < 0) throw new RangeError('Allocation weights cannot be negative.');
  });

  if (amountMinor === 0) {
    return weights.map(({ memberId }) => ({ memberId, amountMinor: 0 }));
  }

  const totalWeight = weights.reduce((sum, weight) => sum + BigInt(weight.weightMinor), 0n);
  if (totalWeight === 0n) {
    throw new RangeError('A non-zero proportional amount needs at least one positive weight.');
  }

  const sign = amountMinor < 0 ? -1 : 1;
  const absoluteAmount = BigInt(Math.abs(amountMinor));
  let allocated = 0n;

  const rows = weights.map((weight, index) => {
    const numerator = absoluteAmount * BigInt(weight.weightMinor);
    const base = numerator / totalWeight;
    allocated += base;
    return {
      memberId: weight.memberId,
      index,
      amount: base,
      fraction: numerator % totalWeight,
    };
  });

  const remainder = Number(absoluteAmount - allocated);
  const remainderOrder = [...rows].sort((left, right) => {
    if (left.fraction === right.fraction) return left.index - right.index;
    return left.fraction > right.fraction ? -1 : 1;
  });

  for (let index = 0; index < remainder; index += 1) {
    remainderOrder[index].amount += 1n;
  }

  return rows.map(row => ({
    memberId: row.memberId,
    amountMinor: row.amount === 0n ? 0 : sign * Number(row.amount),
  }));
}

/**
 * Converts member totals through Parité's canonical conversion helper, then
 * reconciles member-level rounding to that helper's converted receipt total.
 */
export function convertAndReconcileMinorShares(
  receiptTotalMinor: number,
  memberShares: readonly MinorAllocationShare[],
  exchangeRateToBase: number
): { convertedTotalMinor: number; shares: MinorAllocationShare[] } {
  assertSafeMinor(receiptTotalMinor, 'Receipt total');
  if (receiptTotalMinor < 0) throw new RangeError('Receipt total cannot be negative.');
  assertUniqueMemberIds(memberShares.map(share => share.memberId));

  if (!Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0) {
    throw new RangeError('Exchange rate must be a finite number greater than zero.');
  }
  const persistedExchangeRate = Math.round(exchangeRateToBase * 100_000_000) / 100_000_000;
  if (persistedExchangeRate !== exchangeRateToBase) {
    throw new RangeError('Exchange rate must use no more than eight decimal places.');
  }

  const receiptShareTotal = memberShares.reduce((sum, share) => {
    assertSafeMinor(share.amountMinor, 'Member share');
    if (share.amountMinor < 0) throw new RangeError('Converted member shares cannot be negative.');
    return sum + BigInt(share.amountMinor);
  }, 0n);

  if (receiptShareTotal !== BigInt(receiptTotalMinor)) {
    throw new RangeError('Member shares must equal the receipt total before conversion.');
  }

  const convertedTotalAmount = calculateConvertedAmount(receiptTotalMinor / 100, exchangeRateToBase);
  const convertedTotalMinor = Math.round(convertedTotalAmount * 100);
  assertSafeMinor(convertedTotalMinor, 'Converted receipt total');
  if (receiptTotalMinor > 0 && convertedTotalMinor <= 0) {
    throw new RangeError('Converted receipt total must be greater than zero.');
  }

  const converted = memberShares.map((share, index) => {
    const amount = calculateConvertedAmount(share.amountMinor / 100, exchangeRateToBase);
    const amountMinor = Math.round(amount * 100);
    assertSafeMinor(amountMinor, 'Converted member share');
    return {
      memberId: share.memberId,
      amountMinor,
      index,
      roundingResidual: (share.amountMinor * exchangeRateToBase) - amountMinor,
      originalAmountMinor: share.amountMinor,
    };
  });

  const independentlyConvertedTotal = converted.reduce(
    (sum, share) => sum + BigInt(share.amountMinor),
    0n
  );
  const differenceBigInt = BigInt(convertedTotalMinor) - independentlyConvertedTotal;
  if (
    differenceBigInt > BigInt(MAX_EXPENSE_MINOR)
    || differenceBigInt < BigInt(-MAX_EXPENSE_MINOR)
  ) {
    throw new RangeError('Converted member-share rounding difference is too large to reconcile safely.');
  }
  let difference = Number(differenceBigInt);

  const incrementOrder = converted
    .filter(share => share.originalAmountMinor > 0)
    .sort((left, right) => (
      right.roundingResidual - left.roundingResidual || left.index - right.index
    ));
  const decrementOrder = converted
    .filter(share => share.amountMinor > 0)
    .sort((left, right) => (
      left.roundingResidual - right.roundingResidual || left.index - right.index
    ));

  let cursor = 0;
  while (difference > 0 && incrementOrder.length > 0) {
    incrementOrder[cursor % incrementOrder.length].amountMinor += 1;
    cursor += 1;
    difference -= 1;
  }

  cursor = 0;
  while (difference < 0 && decrementOrder.length > 0) {
    const share = decrementOrder[cursor % decrementOrder.length];
    if (share.amountMinor > 0) {
      share.amountMinor -= 1;
      difference += 1;
    }
    cursor += 1;
    if (cursor > converted.length * 2 + Math.abs(difference) * converted.length) break;
  }

  if (difference !== 0) {
    throw new RangeError('Converted member shares could not be reconciled safely.');
  }

  return {
    convertedTotalMinor,
    shares: converted
      .sort((left, right) => left.index - right.index)
      .map(({ memberId, amountMinor }) => ({ memberId, amountMinor })),
  };
}
