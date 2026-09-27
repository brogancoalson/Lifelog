export type Category =
  | 'food'
  | 'drink'
  | 'workout'
  | 'activity'
  | 'business'
  | 'social'
  | 'mood'
  | 'money'
  | 'note';

export type AwardArea = 'service' | 'personal' | 'fitness' | 'expedition';

export interface Lift {
  name: string;
  weight?: number; // lbs
  reps?: number;
  sets?: number;
}

export interface Entry {
  id: string;
  createdAt: string; // ISO timestamp when logged
  date: string; // YYYY-MM-DD, the day it happened
  time?: string; // HH:MM, optional
  category: Category;
  text: string; // short human description
  minutes?: number; // duration
  amount?: number; // quantity (e.g. 32 for 32 oz)
  unit?: string; // oz, cups, servings...
  kind?: string; // water, coffee, beer, run, client call...
  calories?: number;
  protein?: number; // grams
  money?: number; // + made, - spent (USD)
  mood?: number; // 1-5
  lifts?: Lift[];
  awardArea?: AwardArea; // counts toward Congressional Award
  validator?: string; // who can verify the award hours
  source: 'chat' | 'manual' | 'health';
}

export type GoalPeriod = 'day' | 'week' | 'month' | 'all';
export type GoalField =
  | 'count'
  | 'minutes'
  | 'amount'
  | 'moneyIn'
  | 'moneyOut'
  | 'calories'
  | 'protein'
  | 'manual';

export interface Goal {
  id: string;
  title: string;
  target: number;
  unit: string;
  period: GoalPeriod;
  field: GoalField;
  category?: Category; // which entries count (unless manual)
  kind?: string; // optional filter, e.g. "water"
  manualProgress?: number;
  createdAt: string;
}

export interface AwardSettings {
  level: string;
  targets: Record<AwardArea, number>; // hours; expedition = nights
  startedOn?: string; // YYYY-MM-DD
  minMonths: number;
  expeditionDone: boolean;
}

export interface Settings {
  aiEndpoint?: string; // Supabase function URL
  aiKey?: string; // Supabase anon key
  award: AwardSettings;
}

export interface ChatMessage {
  id: string;
  role: 'me' | 'app';
  text: string;
  entryIds?: string[];
  createdAt: string;
  undone?: boolean;
}

export interface AppData {
  version: 1;
  entries: Entry[];
  goals: Goal[];
  settings: Settings;
  chat: ChatMessage[];
}
