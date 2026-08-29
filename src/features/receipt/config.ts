const readBooleanFlag = (value: string | undefined) => value?.trim().toLowerCase() === 'true';

export const isReceiptImportEnabled = readBooleanFlag(
  import.meta.env.VITE_RECEIPT_IMPORT_ENABLED,
);

export const isReceiptImportMockEnabled = import.meta.env.DEV && readBooleanFlag(
  import.meta.env.VITE_RECEIPT_IMPORT_MOCK,
);
