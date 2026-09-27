import type { AwardArea, Category } from '../types';

export interface CategoryMeta {
  label: string;
  icon: string; // Ionicons name
  color: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  food: { label: 'Food', icon: 'restaurant', color: '#F08A3C' },
  drink: { label: 'Drink', icon: 'water', color: '#3D9BF0' },
  workout: { label: 'Workout', icon: 'barbell', color: '#EF5B5B' },
  activity: { label: 'Activity', icon: 'walk', color: '#2FB8A8' },
  business: { label: 'Business', icon: 'briefcase', color: '#B07BF7' },
  social: { label: 'Social', icon: 'heart', color: '#F06BA8' },
  mood: { label: 'Mood', icon: 'happy', color: '#7C8CF8' },
  money: { label: 'Money', icon: 'cash', color: '#45C27A' },
  note: { label: 'Note', icon: 'document-text', color: '#9AA0A6' },
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
