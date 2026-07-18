export function normalizeDecimalInput(value: string): string {
  return value.replace(/[,\u066b]/g, '.');
}

export function isDecimalInputValue(value: string): boolean {
  const normalizedValue = normalizeDecimalInput(value);
  return normalizedValue === '' || /^\d*\.?\d*$/.test(normalizedValue);
}

export function isMoneyInputValue(value: string): boolean {
  const normalizedValue = normalizeDecimalInput(value);
  return normalizedValue === '' || /^\d*\.?\d{0,2}$/.test(normalizedValue);
}

export function parsePositiveDecimal(value: string): number | null {
  const parsed = Number(normalizeDecimalInput(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parsePositiveMoney(value: string): number | null {
  const normalizedValue = normalizeDecimalInput(value);
  if (!isMoneyInputValue(normalizedValue) || normalizedValue === '' || normalizedValue === '.') {
    return null;
  }

  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
