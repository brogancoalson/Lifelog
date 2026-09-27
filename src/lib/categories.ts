import type { AwardArea, Category } from '../types';

export interface CategoryMeta {
  label: string;
  icon: string; // Ionicons name
  color: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  food: { label: 'Food', icon: 'restaurant', color: '#B0683A' },
  drink: { label: 'Drink', icon: 'water', color: '#56799A' },
  workout: { label: 'Workout', icon: 'barbell', color: '#A39A8A' },
  activity: { label: 'Activity', icon: 'walk', color: '#4E8078' },
  business: { label: 'Business', icon: 'briefcase', color: '#7B6A95' },
  social: { label: 'Social', icon: 'heart', color: '#9E5A6B' },
  mood: { label: 'Mood', icon: 'happy', color: '#A8893F' },
  money: { label: 'Money', icon: 'cash', color: '#5E8C52' },
  note: { label: 'Note', icon: 'document-text', color: '#6A665F' },
};

export const CATEGORY_ORDER: Category[] = [
  'food',
  'drink',
  'workout',
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
  return typeof v === 'string' && v in CATEGORIES;
}

export function isAwardArea(v: unknown): v is AwardArea {
  return typeof v === 'string' && v in AWARD_AREAS;
}
