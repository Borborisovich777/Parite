import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bird,
  Cat,
  Crown,
  Dog,
  Fish,
  Flower2,
  Heart,
  Leaf,
  Rabbit,
  Rocket,
  Smile,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Member } from '../types';

export type AvatarMember = Pick<Member, 'id' | 'user_id' | 'display_name'>;

export const AVATAR_ICON_OPTIONS = [
  { id: 'smile', label: 'Smile', Icon: Smile },
  { id: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { id: 'heart', label: 'Heart', Icon: Heart },
  { id: 'flower', label: 'Flower', Icon: Flower2 },
  { id: 'leaf', label: 'Leaf', Icon: Leaf },
  { id: 'cat', label: 'Cat', Icon: Cat },
  { id: 'dog', label: 'Dog', Icon: Dog },
  { id: 'rabbit', label: 'Rabbit', Icon: Rabbit },
  { id: 'bird', label: 'Bird', Icon: Bird },
  { id: 'fish', label: 'Fish', Icon: Fish },
  { id: 'rocket', label: 'Rocket', Icon: Rocket },
  { id: 'crown', label: 'Crown', Icon: Crown },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  Icon: LucideIcon;
}>;

export type AvatarIconId = typeof AVATAR_ICON_OPTIONS[number]['id'];

export const AVATAR_COLOR_OPTIONS = [
  { id: 'mint', label: 'Mint', background: '#dff7eb', foreground: '#28745b', ring: '#9fdec0' },
  { id: 'sky', label: 'Sky', background: '#ddeeff', foreground: '#35648c', ring: '#accfef' },
  { id: 'lilac', label: 'Lilac', background: '#eadffc', foreground: '#6b4a91', ring: '#cbb4ed' },
  { id: 'peach', label: 'Peach', background: '#ffe5d2', foreground: '#9a5537', ring: '#f4b995' },
  { id: 'rose', label: 'Rose', background: '#ffe0e8', foreground: '#99435c', ring: '#f3abc0' },
  { id: 'gold', label: 'Gold', background: '#fff0c7', foreground: '#85601c', ring: '#e8cd7a' },
  { id: 'aqua', label: 'Aqua', background: '#d8f5f3', foreground: '#247674', ring: '#99dcd7' },
  { id: 'slate', label: 'Slate', background: '#e5e9f1', foreground: '#445066', ring: '#bac3d2' },
] as const;

export type AvatarColorId = typeof AVATAR_COLOR_OPTIONS[number]['id'];

export interface AvatarPreference {
  icon: AvatarIconId;
  color: AvatarColorId;
}

interface StoredAvatarPreference extends AvatarPreference {
  version: 1;
}

interface AvatarPreferenceState {
  preference: AvatarPreference;
  isCustomized: boolean;
}

const AVATAR_PREFERENCE_VERSION = 1;
const AVATAR_STORAGE_PREFIX = 'parite:member-avatar:v1:';
const AVATAR_CHANGE_EVENT = 'parite:member-avatar-change';

const iconIds = new Set<string>(AVATAR_ICON_OPTIONS.map(option => option.id));
const colorIds = new Set<string>(AVATAR_COLOR_OPTIONS.map(option => option.id));

export function getMemberAvatarIdentity(member: AvatarMember): string {
  return member.user_id?.trim() || member.id;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDefaultAvatarPreference(identity: string): AvatarPreference {
  const iconIndex = hashString(`${identity}:icon`) % AVATAR_ICON_OPTIONS.length;
  const colorIndex = hashString(`${identity}:color`) % AVATAR_COLOR_OPTIONS.length;

  return {
    icon: AVATAR_ICON_OPTIONS[iconIndex].id,
    color: AVATAR_COLOR_OPTIONS[colorIndex].id,
  };
}

export function getAvatarIconOption(icon: AvatarIconId) {
  return AVATAR_ICON_OPTIONS.find(option => option.id === icon) ?? AVATAR_ICON_OPTIONS[0];
}

export function getAvatarColorOption(color: AvatarColorId) {
  return AVATAR_COLOR_OPTIONS.find(option => option.id === color) ?? AVATAR_COLOR_OPTIONS[0];
}

function getAvatarStorageKey(identity: string): string {
  return `${AVATAR_STORAGE_PREFIX}${encodeURIComponent(identity)}`;
}

function isStoredAvatarPreference(value: unknown): value is StoredAvatarPreference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const candidate = value as Partial<StoredAvatarPreference>;
  return candidate.version === AVATAR_PREFERENCE_VERSION
    && typeof candidate.icon === 'string'
    && iconIds.has(candidate.icon)
    && typeof candidate.color === 'string'
    && colorIds.has(candidate.color);
}

function readStoredAvatarPreference(identity: string): AvatarPreference | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(getAvatarStorageKey(identity));
    if (!rawValue) return null;

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isStoredAvatarPreference(parsedValue)) return null;

    return {
      icon: parsedValue.icon,
      color: parsedValue.color,
    };
  } catch {
    return null;
  }
}

function publishAvatarChange(identity: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AVATAR_CHANGE_EVENT, { detail: { identity } }));
}

function writeStoredAvatarPreference(identity: string, preference: AvatarPreference): boolean {
  if (typeof window === 'undefined' || !iconIds.has(preference.icon) || !colorIds.has(preference.color)) {
    return false;
  }

  const payload: StoredAvatarPreference = {
    version: AVATAR_PREFERENCE_VERSION,
    icon: preference.icon,
    color: preference.color,
  };

  try {
    window.localStorage.setItem(getAvatarStorageKey(identity), JSON.stringify(payload));
    publishAvatarChange(identity);
    return true;
  } catch {
    return false;
  }
}

function removeStoredAvatarPreference(identity: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.removeItem(getAvatarStorageKey(identity));
    publishAvatarChange(identity);
    return true;
  } catch {
    return false;
  }
}

export function useMemberAvatarPreference(member?: AvatarMember | null) {
  const identity = member ? getMemberAvatarIdentity(member) : null;
  const defaultPreference = useMemo(
    () => getDefaultAvatarPreference(identity ?? 'parite-guest'),
    [identity]
  );

  const readPreferenceState = useCallback((): AvatarPreferenceState => {
    if (!identity) {
      return { preference: defaultPreference, isCustomized: false };
    }

    const storedPreference = readStoredAvatarPreference(identity);
    return {
      preference: storedPreference ?? defaultPreference,
      isCustomized: Boolean(storedPreference),
    };
  }, [defaultPreference, identity]);

  const [state, setState] = useState<AvatarPreferenceState>(readPreferenceState);

  useEffect(() => {
    setState(readPreferenceState());
  }, [readPreferenceState]);

  useEffect(() => {
    if (!identity || typeof window === 'undefined') return undefined;

    const storageKey = getAvatarStorageKey(identity);
    const refreshPreference = () => setState(readPreferenceState());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) refreshPreference();
    };
    const handleLocalChange = (event: Event) => {
      const changedIdentity = (event as CustomEvent<{ identity?: string }>).detail?.identity;
      if (changedIdentity === identity) refreshPreference();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(AVATAR_CHANGE_EVENT, handleLocalChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AVATAR_CHANGE_EVENT, handleLocalChange);
    };
  }, [identity, readPreferenceState]);

  const savePreference = useCallback((preference: AvatarPreference): boolean => {
    if (!identity) return false;
    const didSave = writeStoredAvatarPreference(identity, preference);
    if (didSave) setState({ preference, isCustomized: true });
    return didSave;
  }, [identity]);

  const resetPreference = useCallback((): boolean => {
    if (!identity) return false;
    const didReset = removeStoredAvatarPreference(identity);
    if (didReset) setState({ preference: defaultPreference, isCustomized: false });
    return didReset;
  }, [defaultPreference, identity]);

  return {
    preference: state.preference,
    defaultPreference,
    isCustomized: state.isCustomized,
    savePreference,
    resetPreference,
  };
}
