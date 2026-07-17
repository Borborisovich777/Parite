import type { Icon } from '@phosphor-icons/react';
import { AirplaneTilt } from '@phosphor-icons/react/dist/csr/AirplaneTilt';
import { Barbell } from '@phosphor-icons/react/dist/csr/Barbell';
import { Basket } from '@phosphor-icons/react/dist/csr/Basket';
import { Bed } from '@phosphor-icons/react/dist/csr/Bed';
import { Bread } from '@phosphor-icons/react/dist/csr/Bread';
import { Briefcase } from '@phosphor-icons/react/dist/csr/Briefcase';
import { Broom } from '@phosphor-icons/react/dist/csr/Broom';
import { Bus } from '@phosphor-icons/react/dist/csr/Bus';
import { CarProfile } from '@phosphor-icons/react/dist/csr/CarProfile';
import { Coffee } from '@phosphor-icons/react/dist/csr/Coffee';
import { Couch } from '@phosphor-icons/react/dist/csr/Couch';
import { DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { FilmSlate } from '@phosphor-icons/react/dist/csr/FilmSlate';
import { FirstAid } from '@phosphor-icons/react/dist/csr/FirstAid';
import { ForkKnife } from '@phosphor-icons/react/dist/csr/ForkKnife';
import { GameController } from '@phosphor-icons/react/dist/csr/GameController';
import { GasPump } from '@phosphor-icons/react/dist/csr/GasPump';
import { Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { Hamburger } from '@phosphor-icons/react/dist/csr/Hamburger';
import { Hammer } from '@phosphor-icons/react/dist/csr/Hammer';
import { HouseLine } from '@phosphor-icons/react/dist/csr/HouseLine';
import { IceCream } from '@phosphor-icons/react/dist/csr/IceCream';
import { LetterCircleP } from '@phosphor-icons/react/dist/csr/LetterCircleP';
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { Motorcycle } from '@phosphor-icons/react/dist/csr/Motorcycle';
import { MusicNotes } from '@phosphor-icons/react/dist/csr/MusicNotes';
import { PawPrint } from '@phosphor-icons/react/dist/csr/PawPrint';
import { Pill } from '@phosphor-icons/react/dist/csr/Pill';
import { Repeat } from '@phosphor-icons/react/dist/csr/Repeat';
import { ShoppingBag } from '@phosphor-icons/react/dist/csr/ShoppingBag';
import { ShoppingCart } from '@phosphor-icons/react/dist/csr/ShoppingCart';
import { SoccerBall } from '@phosphor-icons/react/dist/csr/SoccerBall';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { Taxi } from '@phosphor-icons/react/dist/csr/Taxi';
import { Ticket } from '@phosphor-icons/react/dist/csr/Ticket';
import { Train } from '@phosphor-icons/react/dist/csr/Train';
import { TShirt } from '@phosphor-icons/react/dist/csr/TShirt';
import { Wine } from '@phosphor-icons/react/dist/csr/Wine';

export type ExpenseVisualCategoryId =
  | 'food-drink'
  | 'transport'
  | 'stay-home'
  | 'shopping'
  | 'fun'
  | 'care'
  | 'life-other';

export interface ExpenseVisualPalette {
  readonly surface: string;
  readonly surfaceStrong: string;
  readonly foreground: string;
  readonly border: string;
}

export interface ExpenseVisualCategory {
  readonly id: ExpenseVisualCategoryId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly palette: ExpenseVisualPalette;
}

interface ExpenseVisualPresetDefinition {
  readonly id: string;
  readonly label: string;
  readonly categoryId: ExpenseVisualCategoryId;
  readonly icon: Icon;
  readonly keywords: readonly string[];
}

export const EXPENSE_VISUAL_CATEGORIES = [
  {
    id: 'food-drink',
    label: 'Food & drink',
    shortLabel: 'Food',
    description: 'Meals, groceries, coffee and treats',
    palette: {
      surface: '#FCECE5',
      surfaceStrong: '#F8D8CA',
      foreground: '#A94D34',
      border: '#F3C9B9',
    },
  },
  {
    id: 'transport',
    label: 'Transport',
    shortLabel: 'Travel',
    description: 'Rides, fuel, flights and public transit',
    palette: {
      surface: '#E7F2FC',
      surfaceStrong: '#CFE7F8',
      foreground: '#2E6F99',
      border: '#B9DCF3',
    },
  },
  {
    id: 'stay-home',
    label: 'Stay & home',
    shortLabel: 'Home',
    description: 'Accommodation, rent and household costs',
    palette: {
      surface: '#EDEAFB',
      surfaceStrong: '#DDD6F7',
      foreground: '#6552A0',
      border: '#D0C8EF',
    },
  },
  {
    id: 'shopping',
    label: 'Shopping',
    shortLabel: 'Shop',
    description: 'Clothes, electronics, gifts and orders',
    palette: {
      surface: '#FFF1D9',
      surfaceStrong: '#FCE2B5',
      foreground: '#A96318',
      border: '#F4D49D',
    },
  },
  {
    id: 'fun',
    label: 'Fun',
    shortLabel: 'Fun',
    description: 'Movies, music, games, sports and events',
    palette: {
      surface: '#FBE8F2',
      surfaceStrong: '#F5D2E5',
      foreground: '#9A4774',
      border: '#EDC3DA',
    },
  },
  {
    id: 'care',
    label: 'Care',
    shortLabel: 'Care',
    description: 'Health, wellness, beauty and pets',
    palette: {
      surface: '#E4F5EC',
      surfaceStrong: '#CDEAD9',
      foreground: '#277257',
      border: '#B9DFC9',
    },
  },
  {
    id: 'life-other',
    label: 'Life & other',
    shortLabel: 'Other',
    description: 'Learning, work, subscriptions and anything else',
    palette: {
      surface: '#EEF0F4',
      surfaceStrong: '#DDE1E8',
      foreground: '#596273',
      border: '#D2D7E0',
    },
  },
] as const satisfies readonly ExpenseVisualCategory[];

/**
 * Forty presentation-only presets. Their order is the category/grid order;
 * inference uses the more-specific order declared below.
 */
export const EXPENSE_VISUAL_PRESETS = [
  {
    id: 'groceries',
    label: 'Groceries',
    categoryId: 'food-drink',
    icon: Basket,
    keywords: ['groceries', 'grocery', 'supermarket', 'carrefour', 'waitrose', 'spinneys', 'costco', 'whole foods', 'lulu hypermarket'],
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    categoryId: 'food-drink',
    icon: ForkKnife,
    keywords: ['restaurant', 'dinner', 'lunch', 'breakfast', 'brunch', 'dining', 'meal', 'sushi', 'ramen', 'steakhouse', 'bistro'],
  },
  {
    id: 'coffee',
    label: 'Coffee',
    categoryId: 'food-drink',
    icon: Coffee,
    keywords: ['coffee', 'cafe', 'latte', 'cappuccino', 'espresso', 'starbucks', 'costa coffee'],
  },
  {
    id: 'fast-food',
    label: 'Fast food',
    categoryId: 'food-drink',
    icon: Hamburger,
    keywords: ['fast food', 'burger', 'pizza', 'fries', 'mcdonald', 'kfc', 'subway', 'taco', 'shawarma'],
  },
  {
    id: 'drinks',
    label: 'Drinks',
    categoryId: 'food-drink',
    icon: Wine,
    keywords: ['drinks', 'drink', 'wine', 'beer', 'cocktail', 'bar', 'pub', 'alcohol'],
  },
  {
    id: 'bakery',
    label: 'Bakery',
    categoryId: 'food-drink',
    icon: Bread,
    keywords: ['bakery', 'bread', 'pastry', 'croissant', 'bagel', 'boulangerie'],
  },
  {
    id: 'dessert',
    label: 'Dessert',
    categoryId: 'food-drink',
    icon: IceCream,
    keywords: ['dessert', 'ice cream', 'gelato', 'cake', 'sweets', 'chocolate', 'candy'],
  },
  {
    id: 'food-delivery',
    label: 'Food delivery',
    categoryId: 'food-drink',
    icon: Motorcycle,
    keywords: ['food delivery', 'uber eats', 'deliveroo', 'talabat', 'doordash', 'foodpanda', 'careem food', 'takeaway', 'takeout'],
  },
  {
    id: 'taxi',
    label: 'Taxi',
    categoryId: 'transport',
    icon: Taxi,
    keywords: ['taxi', 'cab', 'uber', 'careem', 'bolt', 'lyft', 'ride share', 'rideshare'],
  },
  {
    id: 'fuel',
    label: 'Fuel',
    categoryId: 'transport',
    icon: GasPump,
    keywords: ['fuel', 'petrol', 'diesel', 'gas station', 'shell station', 'adnoc', 'enoc', 'ev charging', 'car charging'],
  },
  {
    id: 'flights',
    label: 'Flights',
    categoryId: 'transport',
    icon: AirplaneTilt,
    keywords: ['flight', 'flights', 'airfare', 'airline', 'airport', 'emirates', 'etihad', 'flydubai', 'wizz air'],
  },
  {
    id: 'public-transit',
    label: 'Public transit',
    categoryId: 'transport',
    icon: Bus,
    keywords: ['public transit', 'bus', 'metro', 'subway fare', 'tram', 'transit pass', 'nol card', 'bus fare'],
  },
  {
    id: 'train',
    label: 'Train',
    categoryId: 'transport',
    icon: Train,
    keywords: ['train', 'rail', 'railway', 'eurostar', 'amtrak'],
  },
  {
    id: 'parking',
    label: 'Parking',
    categoryId: 'transport',
    icon: LetterCircleP,
    keywords: ['parking', 'parked car', 'parking meter', 'valet'],
  },
  {
    id: 'car-rental',
    label: 'Car rental',
    categoryId: 'transport',
    icon: CarProfile,
    keywords: ['car rental', 'rental car', 'hire car', 'hertz', 'avis', 'sixt', 'enterprise rent a car'],
  },
  {
    id: 'hotel',
    label: 'Hotel',
    categoryId: 'stay-home',
    icon: Bed,
    keywords: ['hotel', 'hostel', 'airbnb', 'accommodation', 'resort', 'motel', 'lodging', 'booking com'],
  },
  {
    id: 'rent',
    label: 'Rent',
    categoryId: 'stay-home',
    icon: HouseLine,
    keywords: ['rent', 'lease', 'mortgage', 'apartment rent', 'house rent'],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    categoryId: 'stay-home',
    icon: Lightning,
    keywords: ['utilities', 'electricity', 'water bill', 'internet bill', 'wifi bill', 'phone bill', 'mobile plan', 'gas bill', 'dewa'],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    categoryId: 'stay-home',
    icon: Couch,
    keywords: ['furniture', 'sofa', 'couch', 'table', 'chair', 'mattress', 'ikea'],
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    categoryId: 'stay-home',
    icon: Broom,
    keywords: ['cleaning', 'cleaner', 'laundry', 'dry cleaning', 'housekeeping'],
  },
  {
    id: 'home-repair',
    label: 'Home repair',
    categoryId: 'stay-home',
    icon: Hammer,
    keywords: ['home repair', 'repair', 'maintenance', 'plumber', 'plumbing', 'electrician', 'hardware store'],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    categoryId: 'shopping',
    icon: ShoppingBag,
    keywords: ['shopping', 'department store', 'mall', 'store purchase', 'retail'],
  },
  {
    id: 'clothing',
    label: 'Clothing',
    categoryId: 'shopping',
    icon: TShirt,
    keywords: ['clothing', 'clothes', 'shirt', 'shoes', 'fashion', 'zara', 'uniqlo', 'h and m', 'apparel'],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    categoryId: 'shopping',
    icon: DeviceMobile,
    keywords: ['electronics', 'phone', 'laptop', 'computer', 'tablet', 'headphones', 'apple store', 'samsung', 'gadget'],
  },
  {
    id: 'gifts',
    label: 'Gifts',
    categoryId: 'shopping',
    icon: Gift,
    keywords: ['gift', 'gifts', 'present', 'birthday present', 'souvenir'],
  },
  {
    id: 'online-shopping',
    label: 'Online order',
    categoryId: 'shopping',
    icon: ShoppingCart,
    keywords: ['online shopping', 'online order', 'amazon', 'ebay', 'aliexpress', 'temu', 'noon order'],
  },
  {
    id: 'movies',
    label: 'Movies',
    categoryId: 'fun',
    icon: FilmSlate,
    keywords: ['movie', 'movies', 'cinema', 'film', 'netflix', 'prime video', 'disney plus', 'hbo'],
  },
  {
    id: 'music',
    label: 'Music',
    categoryId: 'fun',
    icon: MusicNotes,
    keywords: ['music', 'spotify', 'apple music', 'concert album', 'soundcloud'],
  },
  {
    id: 'games',
    label: 'Games',
    categoryId: 'fun',
    icon: GameController,
    keywords: ['game', 'games', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam purchase', 'arcade'],
  },
  {
    id: 'sports',
    label: 'Sports',
    categoryId: 'fun',
    icon: SoccerBall,
    keywords: ['sports', 'football', 'soccer', 'basketball', 'tennis', 'golf', 'match ticket'],
  },
  {
    id: 'events',
    label: 'Events',
    categoryId: 'fun',
    icon: Ticket,
    keywords: ['event', 'events', 'concert', 'festival', 'museum', 'theatre', 'theater', 'show ticket', 'attraction'],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    categoryId: 'care',
    icon: FirstAid,
    keywords: ['healthcare', 'doctor', 'hospital', 'clinic', 'dentist', 'dental', 'medical', 'therapy'],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    categoryId: 'care',
    icon: Pill,
    keywords: ['pharmacy', 'medicine', 'medication', 'prescription', 'chemist'],
  },
  {
    id: 'beauty',
    label: 'Beauty',
    categoryId: 'care',
    icon: Sparkle,
    keywords: ['beauty', 'salon', 'haircut', 'barber', 'spa', 'nails', 'cosmetics', 'skincare'],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    categoryId: 'care',
    icon: Barbell,
    keywords: ['fitness', 'gym', 'workout', 'yoga', 'pilates', 'personal trainer'],
  },
  {
    id: 'pets',
    label: 'Pets',
    categoryId: 'care',
    icon: PawPrint,
    keywords: ['pet', 'pets', 'vet', 'veterinary', 'dog', 'cat', 'pet food', 'grooming'],
  },
  {
    id: 'education',
    label: 'Education',
    categoryId: 'life-other',
    icon: GraduationCap,
    keywords: ['education', 'school', 'university', 'college', 'course', 'class', 'tuition', 'books', 'training'],
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    categoryId: 'life-other',
    icon: Repeat,
    keywords: ['subscription', 'subscriptions', 'membership', 'monthly plan', 'annual plan', 'renewal'],
  },
  {
    id: 'work',
    label: 'Work',
    categoryId: 'life-other',
    icon: Briefcase,
    keywords: ['work', 'business', 'office', 'coworking', 'client expense', 'professional fee'],
  },
  {
    id: 'miscellaneous',
    label: 'Miscellaneous',
    categoryId: 'life-other',
    icon: DotsThree,
    keywords: [],
  },
] as const satisfies readonly ExpenseVisualPresetDefinition[];

export type ExpenseVisualPreset = (typeof EXPENSE_VISUAL_PRESETS)[number];
export type ExpenseVisualId = ExpenseVisualPreset['id'];

export const EXPENSE_VISUAL_PRESET_COUNT = 40 as const;
export const MISCELLANEOUS_EXPENSE_VISUAL_ID: ExpenseVisualId = 'miscellaneous';
export const RECENT_EXPENSE_VISUAL_STORAGE_KEY = 'parite_recent_expense_visual_ids_v1';
export const RECENT_EXPENSE_VISUAL_LIMIT = 6;
const EXPENSE_VISUAL_PREFERENCE_STORAGE_PREFIX = 'parite:expense-visual:v1:';

if (EXPENSE_VISUAL_PRESETS.length !== EXPENSE_VISUAL_PRESET_COUNT) {
  throw new Error(`Expected ${EXPENSE_VISUAL_PRESET_COUNT} expense visual presets.`);
}

const presetById = new Map<string, ExpenseVisualPreset>(
  EXPENSE_VISUAL_PRESETS.map(preset => [preset.id, preset] as const),
);

const categoryById = new Map<ExpenseVisualCategoryId, ExpenseVisualCategory>(
  EXPENSE_VISUAL_CATEGORIES.map(category => [category.id, category] as const),
);

/**
 * Specific services and phrases come before broad concepts. The first keyword
 * match wins, so resolution is deterministic across list, detail and form UIs.
 */
export const EXPENSE_VISUAL_INFERENCE_ORDER = [
  'food-delivery',
  'groceries',
  'coffee',
  'bakery',
  'dessert',
  'fast-food',
  'drinks',
  'restaurant',
  'taxi',
  'fuel',
  'flights',
  'train',
  'public-transit',
  'parking',
  'car-rental',
  'hotel',
  'rent',
  'utilities',
  'furniture',
  'cleaning',
  'home-repair',
  'clothing',
  'electronics',
  'gifts',
  'online-shopping',
  'shopping',
  'pharmacy',
  'healthcare',
  'beauty',
  'fitness',
  'pets',
  'movies',
  'music',
  'games',
  'sports',
  'events',
  'education',
  'subscriptions',
  'work',
] as const satisfies readonly Exclude<ExpenseVisualId, 'miscellaneous'>[];

export function normalizeExpenseTitle(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function containsKeyword(normalizedTitle: string, keyword: string): boolean {
  const normalizedKeyword = normalizeExpenseTitle(keyword);
  if (!normalizedKeyword) return false;

  return normalizedTitle === normalizedKeyword
    || ` ${normalizedTitle} `.includes(` ${normalizedKeyword} `);
}

export function isExpenseVisualId(value: unknown): value is ExpenseVisualId {
  return typeof value === 'string' && presetById.has(value);
}

export function getExpenseVisualPreset(id: unknown): ExpenseVisualPreset | undefined {
  return isExpenseVisualId(id) ? presetById.get(id) : undefined;
}

export function getExpenseVisualCategory(
  categoryId: ExpenseVisualCategoryId,
): ExpenseVisualCategory {
  const category = categoryById.get(categoryId);
  if (!category) {
    throw new Error(`Unknown expense visual category: ${categoryId}`);
  }
  return category;
}

export function getExpenseVisualPresetsForCategory(
  categoryId: ExpenseVisualCategoryId,
): readonly ExpenseVisualPreset[] {
  return EXPENSE_VISUAL_PRESETS.filter(preset => preset.categoryId === categoryId);
}

export function inferExpenseVisual(title: string): ExpenseVisualPreset {
  const normalizedTitle = normalizeExpenseTitle(title);
  if (!normalizedTitle) {
    return presetById.get(MISCELLANEOUS_EXPENSE_VISUAL_ID)!;
  }

  for (const presetId of EXPENSE_VISUAL_INFERENCE_ORDER) {
    const preset = presetById.get(presetId)!;
    if (preset.keywords.some(keyword => containsKeyword(normalizedTitle, keyword))) {
      return preset;
    }
  }

  return presetById.get(MISCELLANEOUS_EXPENSE_VISUAL_ID)!;
}

/** A valid explicit choice wins; otherwise the title is inferred. */
export function resolveExpenseVisual(
  title: string,
  preferredId?: string | null,
): ExpenseVisualPreset {
  return getExpenseVisualPreset(preferredId) ?? inferExpenseVisual(title);
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage === null) return null;
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getExpenseVisualPreferenceStorageKey(tripId: string, title: string): string | null {
  const normalizedTitle = normalizeExpenseTitle(title);
  if (!tripId.trim() || !normalizedTitle) return null;

  return `${EXPENSE_VISUAL_PREFERENCE_STORAGE_PREFIX}${encodeURIComponent(tripId)}:${encodeURIComponent(normalizedTitle)}`;
}

/**
 * Reads a presentation-only icon choice for a trip/title pair. This deliberately
 * stays in local storage so expense records and API payloads remain unchanged.
 */
export function readExpenseVisualPreference(
  tripId: string,
  title: string,
  storage?: Storage | null,
): ExpenseVisualId | null {
  const storageKey = getExpenseVisualPreferenceStorageKey(tripId, title);
  const targetStorage = resolveStorage(storage);
  if (!storageKey || !targetStorage) return null;

  try {
    const candidate = targetStorage.getItem(storageKey);
    return isExpenseVisualId(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** Saves a presentation-only choice without adding fields to the expense model. */
export function writeExpenseVisualPreference(
  tripId: string,
  title: string,
  visualId: ExpenseVisualId,
  storage?: Storage | null,
): boolean {
  const storageKey = getExpenseVisualPreferenceStorageKey(tripId, title);
  const targetStorage = resolveStorage(storage);
  if (!storageKey || !targetStorage || !isExpenseVisualId(visualId)) return false;

  try {
    targetStorage.setItem(storageKey, visualId);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeRecentExpenseVisualIds(value: unknown): ExpenseVisualId[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<ExpenseVisualId>();
  const validIds: ExpenseVisualId[] = [];

  for (const candidate of value) {
    if (!isExpenseVisualId(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    validIds.push(candidate);
    if (validIds.length === RECENT_EXPENSE_VISUAL_LIMIT) break;
  }

  return validIds;
}

export function readRecentExpenseVisualIds(
  storage?: Storage | null,
): ExpenseVisualId[] {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return [];

  try {
    const rawValue = targetStorage.getItem(RECENT_EXPENSE_VISUAL_STORAGE_KEY);
    if (!rawValue) return [];
    return sanitizeRecentExpenseVisualIds(JSON.parse(rawValue) as unknown);
  } catch {
    return [];
  }
}

export function writeRecentExpenseVisualIds(
  ids: readonly string[],
  storage?: Storage | null,
): ExpenseVisualId[] {
  const validIds = sanitizeRecentExpenseVisualIds(ids);
  const targetStorage = resolveStorage(storage);

  if (targetStorage) {
    try {
      targetStorage.setItem(
        RECENT_EXPENSE_VISUAL_STORAGE_KEY,
        JSON.stringify(validIds),
      );
    } catch {
      // Storage can be unavailable in privacy mode; the UI remains functional.
    }
  }

  return validIds;
}

export function rememberRecentExpenseVisual(
  id: ExpenseVisualId,
  storage?: Storage | null,
): ExpenseVisualId[] {
  return writeRecentExpenseVisualIds(
    [id, ...readRecentExpenseVisualIds(storage)],
    storage,
  );
}
