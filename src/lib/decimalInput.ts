export function isDecimalInputValue(value: string): boolean {
  return value === '' || /^\d*\.?\d*$/.test(value);
}

export function isMoneyInputValue(value: string): boolean {
  return value === '' || /^\d*\.?\d{0,2}$/.test(value);
}

export function parsePositiveDecimal(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
