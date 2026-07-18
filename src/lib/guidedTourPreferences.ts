const GUIDED_TOUR_STORAGE_PREFIX = 'parite:guided-tour:v1';

interface GuidedTourCompletionRecord {
  version: 1;
  status: 'completed' | 'skipped';
  updatedAt: string;
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getGuidedTourStorageKey(identity: string): string | null {
  const normalizedIdentity = identity.trim();
  if (!normalizedIdentity) return null;
  return `${GUIDED_TOUR_STORAGE_PREFIX}:${encodeURIComponent(normalizedIdentity)}`;
}

export function hasCompletedGuidedTour(
  identity: string,
  storage?: Storage | null,
): boolean {
  const storageKey = getGuidedTourStorageKey(identity);
  const targetStorage = resolveStorage(storage);
  if (!storageKey || !targetStorage) return false;

  try {
    const rawValue = targetStorage.getItem(storageKey);
    if (!rawValue) return false;

    const parsedValue = JSON.parse(rawValue) as Partial<GuidedTourCompletionRecord>;
    return parsedValue.version === 1
      && (parsedValue.status === 'completed' || parsedValue.status === 'skipped');
  } catch {
    return false;
  }
}

export function saveGuidedTourCompletion(
  identity: string,
  status: GuidedTourCompletionRecord['status'],
  storage?: Storage | null,
): boolean {
  const storageKey = getGuidedTourStorageKey(identity);
  const targetStorage = resolveStorage(storage);
  if (!storageKey || !targetStorage) return false;

  const record: GuidedTourCompletionRecord = {
    version: 1,
    status,
    updatedAt: new Date().toISOString(),
  };

  try {
    targetStorage.setItem(storageKey, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}
