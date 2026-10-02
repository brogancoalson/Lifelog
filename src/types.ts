export type Category =
  | 'food'
  | 'drink'
  | 'workout'
  | 'activity'
  | 'business'
  | 'social'
  | 'mood'
  | 'money'
  | 'sleep'
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
  carbs?: number; // grams
  nutritionEstimated?: boolean; // calories/protein/carbs are averages, not stated
  money?: number; // + made, - spent (USD)
  mood?: number; // 1-5
  lifts?: Lift[];
  details?: string; // workout written out, one exercise or note per line (shown as bullets)
  awardArea?: AwardArea; // counts toward Congressional Award
  validator?: string; // who can verify the award hours
  bucketId?: string; // money spent out of this bucket
  allocations?: Allocation[]; // income split into buckets
  incomeKind?: 'paycheck' | 'other';
  source: 'chat' | 'manual' | 'health';
}

export interface Allocation {
  bucketId: string;
  amount: number;
}

/** How much a bucket gets from each paycheck. */
export type BucketRule = 'fixed' | 'percent' | 'daily';

export interface Bucket {
  id: string;
  name: string;
  rule: BucketRule;
  value: number; // $ per paycheck, % of paycheck, or $ per day
  kind: 'spend' | 'save'; // save = money put away (retirement, savings)
  keywords?: string[]; // words that auto-assign spending ("gas", "shell")
  start?: number; // money already in it when created
  createdAt: string;
}

export interface Transfer {
  id: string;
  date: string;
  from: string; // bucket id or 'free'
  to: string; // bucket id or 'free'
  amount: number;
  note?: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  date: string;
  time?: string;
  symbol: string;
  direction?: 'long' | 'short';
  contracts?: number;
  entry?: number;
  exit?: number;
  pnl?: number; // dollars, + win / - loss
  setup?: string;
  good?: string;
  bad?: string;
  emotion?: string;
  notes: string;
  images: string[]; // stored image ids
  createdAt: string;
  source: 'chat' | 'manual';
}

export interface PaySettings {
  hourly: number;
  hoursPerDay: number;
  daysPerWeek: number;
  periodDays: number; // paid every N days
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
  | 'carbs'
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
  claudeKey?: string; // Anthropic API key, kept on this device only
  aboutMe?: string; // what the Ask coach should know (weight, targets, training split)
  award: AwardSettings;
  pay: PaySettings;
  freeStart?: number; // free money on hand when buckets were set up
  bucketsSeeded?: boolean;
  latte100?: boolean; // one-time switch of the latte factor to $100 per paycheck (Sept 30)
  estimatesV3?: boolean; // one-time redo of estimated food numbers after the Sept 30 fixes
}

export interface ChatMessage {
  id: string;
  role: 'me' | 'app';
  text: string;
  entryIds?: string[];
  tradeIds?: string[];
  images?: string[];
  createdAt: string;
  undone?: boolean;
}

export interface AppData {
  version: 1;
  entries: Entry[];
  goals: Goal[];
  settings: Settings;
  chat: ChatMessage[];
  buckets: Bucket[];
  transfers: Transfer[];
  trades: Trade[];
  askChat: ChatMessage[];
  tradeChat: ChatMessage[];
}
