import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Allocation, AppData, Bucket, ChatMessage, Entry, Goal, Lift, Settings, Trade, Transfer } from '../types';
import { isAwardArea, isCategory } from './categories';
import { isValidDay, toDay, toTime, uid } from './dates';

const KEY = 'lifelog:data:v1';

/** What Brogan trades; used when a trade doesn't name a symbol. */
export const DEFAULT_SYMBOL = 'MNQ';

export const DEFAULT_PAY = { hourly: 20, hoursPerDay: 5, daysPerWeek: 4, periodDays: 14 };

export const DEFAULT_SETTINGS: Settings = {
  award: {
    level: 'Gold Medal',
    targets: { service: 400, personal: 200, fitness: 200, expedition: 0 },
    minMonths: 24,
    expeditionDone: false,
  },
  pay: DEFAULT_PAY,
};

export function emptyData(): AppData {
  return {
    version: 1,
    entries: [],
    goals: [],
    settings: DEFAULT_SETTINGS,
    chat: [],
    buckets: [],
    transfers: [],
    trades: [],
    askChat: [],
    tradeChat: [],
  };
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

/** Turn anything (AI output, imports, form data) into a safe Entry. */
export function normalizeEntry(raw: any, fallback: Partial<Entry> = {}): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const category = isCategory(raw.category) ? raw.category : 'note';
  const text = str(raw.text, 300) ?? str(raw.description, 300);
  if (!text) return null;
  const lifts: Lift[] | undefined = Array.isArray(raw.lifts)
    ? raw.lifts
        .map((l: any) => ({
          name: str(l?.name, 60) ?? '',
          weight: num(l?.weight),
          reps: num(l?.reps),
          sets: num(l?.sets),
        }))
        .filter((l: Lift) => l.name)
    : undefined;
  // one line per exercise; AI sorting may send an array of lines
  const detailSrc = Array.isArray(raw.details) ? raw.details.filter((l: unknown) => typeof l === 'string').join('\n') : raw.details;
  const details =
    typeof detailSrc === 'string'
      ? detailSrc
          .split('\n')
          .map((l: string) => l.replace(/^\s*[•●▪◦‣*–—-]+\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 60)
          .join('\n')
          .slice(0, 4000) || undefined
      : undefined;
  const mood = num(raw.mood);
  const time = typeof raw.time === 'string' && /^\d{1,2}:\d{2}$/.test(raw.time) ? raw.time.padStart(5, '0') : undefined;
  return {
    id: str(raw.id, 40) ?? uid(),
    createdAt: str(raw.createdAt, 40) ?? new Date().toISOString(),
    date: isValidDay(raw.date) ? raw.date : fallback.date ?? toDay(),
    time: time ?? fallback.time,
    category,
    text,
    minutes: num(raw.minutes),
    amount: num(raw.amount),
    unit: str(raw.unit, 20),
    kind: str(raw.kind, 40)?.toLowerCase(),
    calories: num(raw.calories),
    protein: num(raw.protein),
    carbs: num(raw.carbs),
    nutritionEstimated: raw.nutritionEstimated === true || raw.estimated === true ? true : undefined,
    money: num(raw.money),
    mood: mood !== undefined ? Math.min(5, Math.max(1, Math.round(mood))) : undefined,
    lifts: lifts && lifts.length ? lifts : undefined,
    details,
    awardArea: isAwardArea(raw.awardArea) ? raw.awardArea : undefined,
    validator: str(raw.validator, 80),
    bucketId: str(raw.bucketId, 40),
    allocations: normalizeAllocations(raw.allocations),
    incomeKind: raw.incomeKind === 'paycheck' || raw.incomeKind === 'other' ? raw.incomeKind : undefined,
    source: raw.source === 'chat' || raw.source === 'manual' || raw.source === 'health' ? raw.source : fallback.source ?? 'chat',
  };
}

function normalizeAllocations(raw: any): Allocation[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((a: any) => ({ bucketId: str(a?.bucketId, 40) ?? '', amount: num(a?.amount) ?? 0 }))
    .filter((a: Allocation) => a.bucketId && a.amount > 0);
  return list.length ? list : undefined;
}

export function normalizeBucket(raw: any): Bucket | null {
  const name = str(raw?.name, 40);
  if (!name) return null;
  return {
    id: str(raw.id, 40) ?? uid(),
    name,
    rule: raw.rule === 'percent' || raw.rule === 'daily' ? raw.rule : 'fixed',
    value: Math.max(0, num(raw.value) ?? 0),
    kind: raw.kind === 'save' ? 'save' : 'spend',
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.map((k: any) => str(k, 30)?.toLowerCase()).filter(Boolean).slice(0, 20)
      : undefined,
    start: num(raw.start),
    createdAt: str(raw.createdAt, 40) ?? new Date().toISOString(),
  };
}

function normalizeTransfer(raw: any): Transfer | null {
  const amount = num(raw?.amount);
  const from = str(raw?.from, 40);
  const to = str(raw?.to, 40);
  if (!amount || amount <= 0 || !from || !to || from === to) return null;
  return {
    id: str(raw.id, 40) ?? uid(),
    date: isValidDay(raw.date) ? raw.date : toDay(),
    from,
    to,
    amount,
    note: str(raw.note, 120),
    createdAt: str(raw.createdAt, 40) ?? new Date().toISOString(),
  };
}

export function normalizeTrade(raw: any, fallback: Partial<Trade> = {}): Trade | null {
  if (!raw || typeof raw !== 'object') return null;
  const notes = str(raw.notes, 4000) ?? '';
  const images = Array.isArray(raw.images) ? raw.images.map((i: any) => str(i, 200)).filter(Boolean) : [];
  const hasDetail = ['pnl', 'entry', 'exit', 'contracts'].some((k) => num(raw[k]) !== undefined) || ['setup', 'good', 'bad', 'emotion', 'direction'].some((k) => str(raw[k], 1000));
  if (!notes && !images.length && !hasDetail) return null;
  const time = typeof raw.time === 'string' && /^\d{1,2}:\d{2}$/.test(raw.time) ? raw.time.padStart(5, '0') : undefined;
  return {
    id: str(raw.id, 40) ?? uid(),
    date: isValidDay(raw.date) ? raw.date : fallback.date ?? toDay(),
    time: time ?? fallback.time,
    symbol: (str(raw.symbol, 16) ?? fallback.symbol ?? DEFAULT_SYMBOL).toUpperCase(),
    direction: raw.direction === 'long' || raw.direction === 'short' ? raw.direction : undefined,
    contracts: num(raw.contracts),
    entry: num(raw.entry),
    exit: num(raw.exit),
    pnl: num(raw.pnl),
    setup: str(raw.setup, 200),
    good: str(raw.good, 1000),
    bad: str(raw.bad, 1000),
    emotion: str(raw.emotion, 200),
    notes,
    images,
    createdAt: str(raw.createdAt, 40) ?? new Date().toISOString(),
    source: raw.source === 'manual' ? 'manual' : 'chat',
  };
}

function normalizeChat(raw: any, max = 100): ChatMessage[] {
  return Array.isArray(raw)
    ? raw.filter((m: any) => m && (m.role === 'me' || m.role === 'app') && typeof m.text === 'string').slice(-max)
    : [];
}

function normalizeGoal(raw: any): Goal | null {
  if (!raw || typeof raw !== 'object' || !str(raw.title)) return null;
  const target = num(raw.target);
  if (!target || target <= 0) return null;
  return {
    id: str(raw.id, 40) ?? uid(),
    title: str(raw.title, 80)!,
    target,
    unit: str(raw.unit, 20) ?? '',
    period: ['day', 'week', 'month', 'all'].includes(raw.period) ? raw.period : 'all',
    field: ['count', 'minutes', 'amount', 'moneyIn', 'moneyOut', 'calories', 'protein', 'carbs', 'manual'].includes(raw.field)
      ? raw.field
      : 'manual',
    category: isCategory(raw.category) ? raw.category : undefined,
    kind: str(raw.kind, 40)?.toLowerCase(),
    manualProgress: num(raw.manualProgress),
    createdAt: str(raw.createdAt, 40) ?? new Date().toISOString(),
  };
}

export function normalizeData(raw: any): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const entries = Array.isArray(raw.entries)
    ? (raw.entries.map((e: any) => normalizeEntry(e, { source: 'manual' })).filter(Boolean) as Entry[])
    : [];
  const goals = Array.isArray(raw.goals) ? (raw.goals.map(normalizeGoal).filter(Boolean) as Goal[]) : [];
  const s = raw.settings ?? {};
  const a = s.award ?? {};
  const t = a.targets ?? {};
  const p = s.pay ?? {};
  const settings: Settings = {
    aiEndpoint: str(s.aiEndpoint, 300),
    aiKey: str(s.aiKey, 1000),
    claudeKey: str(s.claudeKey, 300),
    aboutMe: str(s.aboutMe, 2000),
    pay: {
      hourly: num(p.hourly) ?? DEFAULT_PAY.hourly,
      hoursPerDay: num(p.hoursPerDay) ?? DEFAULT_PAY.hoursPerDay,
      daysPerWeek: num(p.daysPerWeek) ?? DEFAULT_PAY.daysPerWeek,
      periodDays: num(p.periodDays) ?? DEFAULT_PAY.periodDays,
    },
    freeStart: num(s.freeStart),
    bucketsSeeded: s.bucketsSeeded === true,
    latte100: s.latte100 === true,
    estimatesV3: s.estimatesV3 === true,
    award: {
      level: str(a.level, 40) ?? base.settings.award.level,
      targets: {
        service: num(t.service) ?? base.settings.award.targets.service,
        personal: num(t.personal) ?? base.settings.award.targets.personal,
        fitness: num(t.fitness) ?? base.settings.award.targets.fitness,
        expedition: num(t.expedition) ?? base.settings.award.targets.expedition,
      },
      startedOn: isValidDay(a.startedOn) ? a.startedOn : undefined,
      minMonths: num(a.minMonths) ?? base.settings.award.minMonths,
      expeditionDone: a.expeditionDone === true,
    },
  };
  const list = <T,>(v: any, f: (x: any) => T | null) => (Array.isArray(v) ? (v.map(f).filter(Boolean) as T[]) : []);
  return {
    version: 1,
    entries,
    goals,
    settings,
    chat: normalizeChat(raw.chat),
    buckets: list(raw.buckets, normalizeBucket),
    transfers: list(raw.transfers, normalizeTransfer),
    trades: list(raw.trades, (t) => normalizeTrade(t)),
    askChat: normalizeChat(raw.askChat, 60),
    tradeChat: normalizeChat(raw.tradeChat, 100),
  };
}

/**
 * Load the saved data. Never lets a read problem wipe the log:
 * - storage can't be read at all -> throws, and the app won't save over it this session
 * - saved text is damaged -> a copy is kept under another key before starting fresh
 */
export async function loadData(): Promise<AppData> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(KEY);
  } catch {
    try {
      raw = await AsyncStorage.getItem(KEY);
    } catch {
      throw new Error('STORAGE_UNREADABLE');
    }
  }
  if (!raw) return emptyData();
  try {
    return normalizeData(JSON.parse(raw));
  } catch {
    try {
      await AsyncStorage.setItem(`${KEY}:unreadable:${Date.now()}`, raw);
    } catch {
      throw new Error('STORAGE_UNREADABLE');
    }
    return emptyData();
  }
}

export async function saveData(data: AppData): Promise<boolean> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function nowStamp() {
  const d = new Date();
  return { date: toDay(d), time: toTime(d) };
}
