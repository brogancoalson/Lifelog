import { IS_FIT } from '../edition';
import type { AwardArea, Category } from '../types';

export interface CategoryMeta {
  label: string;
  icon: string; // Ionicons name
  color: string;
}

const FULL: Record<Category, CategoryMeta> = {
  food: { label: 'Food', icon: 'restaurant', color: '#B0683A' },
  drink: { label: 'Drink', icon: 'water', color: '#56799A' },
  workout: { label: 'Workout', icon: 'barbell', color: '#A39A8A' },
  activity: { label: 'Activity', icon: 'walk', color: '#4E8078' },
  business: { label: 'Business', icon: 'briefcase', color: '#7B6A95' },
  social: { label: 'Social', icon: 'heart', color: '#9E5A6B' },
  mood: { label: 'Mood', icon: 'happy', color: '#A8893F' },
  money: { label: 'Money', icon: 'cash', color: '#5E8C52' },
  sleep: { label: 'Sleep', icon: 'moon', color: '#6878A0' },
  note: { label: 'Note', icon: 'document-text', color: '#6A665F' },
};

// Fit edition: brighter, happier colors on the pink theme.
const FIT_COLORS: Partial<Record<Category, string>> = {
  food: '#F2884B',
  drink: '#3FA7E0',
  workout: '#9B6FE3',
  activity: '#2FB6A0',
  note: '#B08AA0',
};

export const CATEGORIES: Record<Category, CategoryMeta> = IS_FIT
  ? (Object.fromEntries(
      (Object.keys(FULL) as Category[]).map((k) => [k, { ...FULL[k], color: FIT_COLORS[k] ?? FULL[k].color }]),
    ) as Record<Category, CategoryMeta>)
  : FULL;


/** The fit edition only tracks food, drinks, and workouts (plus notes). */
export const CATEGORY_ORDER: Category[] = IS_FIT ? ['food', 'drink', 'workout', 'note'] : [
  'food',
  'drink',
  'workout',
  'sleep',
  'activity',
  'business',
  'social',
  'mood',
  'money',
  'note',
];

export const AWARD_AREAS: Record<AwardArea, { label: string; short: string; unit: string }> = {
  service: { label: 'Voluntary Public Service', short: 'Service', unit: 'hrs' },
  personal: { label: 'Personal Development', short: 'Personal', unit: 'hrs' },
  fitness: { label: 'Physical Fitness', short: 'Fitness', unit: 'hrs' },
  expedition: { label: 'Expedition / Exploration', short: 'Expedition', unit: 'hrs prep' },
};

export const AWARD_ORDER: AwardArea[] = ['service', 'personal', 'fitness', 'expedition'];

export const MOOD_LABELS = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CATEGORIES, v);
}

export function isAwardArea(v: unknown): v is AwardArea {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(AWARD_AREAS, v);
}
