import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData, Entry, Goal, Lift, Settings } from '../types';
import { isAwardArea, isCategory } from './categories';
import { isValidDay, toDay, toTime, uid } from './dates';

const KEY = 'lifelog:data:v1';

export const DEFAULT_SETTINGS: Settings = {
  award: {
    level: 'Gold Medal',
    targets: { service: 400, personal: 200, fitness: 200, expedition: 0 },
    minMonths: 24,
    expeditionDone: false,
  },
};

export function emptyData(): AppData {
  return { version: 1, entries: [], goals: [], settings: DEFAULT_SETTINGS, chat: [] };
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
    money: num(raw.money),
    mood: mood !== undefined ? Math.min(5, Math.max(1, Math.round(mood))) : undefined,
    lifts: lifts && lifts.length ? lifts : undefined,
    awardArea: isAwardArea(raw.awardArea) ? raw.awardArea : undefined,
    validator: str(raw.validator, 80),
    source: raw.source === 'chat' || raw.source === 'manual' || raw.source === 'health' ? raw.source : fallback.source ?? 'chat',
  };
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
    field: ['count', 'minutes', 'amount', 'moneyIn', 'moneyOut', 'calories', 'protein', 'manual'].includes(raw.field)
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
  const settings: Settings = {
    aiEndpoint: str(s.aiEndpoint, 300),
    aiKey: str(s.aiKey, 1000),
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
  const chat = Array.isArray(raw.chat)
    ? raw.chat
        .filter((m: any) => m && (m.role === 'me' || m.role === 'app') && typeof m.text === 'string')
        .slice(-100)
    : [];
  return { version: 1, entries, goals, settings, chat };
}

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? normalizeData(JSON.parse(raw)) : emptyData();
  } catch {
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
