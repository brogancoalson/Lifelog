import type { AwardArea, Entry } from '../types';
import { AWARD_ORDER, CATEGORIES } from './categories';
import { addDays, parseDay, weekStart } from './dates';
import { isWater, toOz } from './stats';

export type TrackerKey = 'water' | 'food' | 'workout' | 'sleep' | 'money' | 'mood' | 'award';
export type RangeKey = '7d' | '30d' | '90d' | 'all';

export interface TrackerMeta {
  title: string;
  icon: string;
  /** category color, or 'accent' for the theme accent */
  color: string;
  chartTitle: string;
}

export const TRACKERS: Record<TrackerKey, TrackerMeta> = {
  water: { title: 'Water', icon: 'water', color: CATEGORIES.drink.color, chartTitle: 'Water per day (oz)' },
  food: { title: 'Meals', icon: 'restaurant', color: CATEGORIES.food.color, chartTitle: 'Meals per day' },
  workout: { title: 'Workouts', icon: 'barbell', color: CATEGORIES.workout.color, chartTitle: 'Workouts per day' },
  sleep: { title: 'Sleep', icon: 'moon', color: CATEGORIES.sleep.color, chartTitle: 'Hours slept per night' },
  money: { title: 'Money', icon: 'cash', color: CATEGORIES.money.color, chartTitle: 'Net per day ($)' },
  mood: { title: 'Mood', icon: 'happy', color: CATEGORIES.mood.color, chartTitle: 'Average mood (1–5)' },
  award: { title: 'Award hours', icon: 'medal', color: 'accent', chartTitle: 'Award hours per day' },
};

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

/** Every entry that belongs to a tracker (all dates). */
export function trackerEntries(key: TrackerKey, entries: Entry[]): Entry[] {
  switch (key) {
    case 'water':
      return entries.filter((e) => e.category === 'drink');
    case 'food':
      return entries.filter((e) => e.category === 'food');
    case 'workout':
      return entries.filter((e) => e.category === 'workout');
    case 'sleep':
      return entries.filter((e) => e.category === 'sleep');
    case 'money':
      return entries.filter((e) => typeof e.money === 'number');
    case 'mood':
      return entries.filter((e) => !!e.mood);
    case 'award':
      return entries.filter((e) => !!e.awardArea);
  }
}

export function rangeStart(range: RangeKey, today: string, entries: Entry[]): string {
  if (range === '7d') return addDays(today, -6);
  if (range === '30d') return addDays(today, -29);
  if (range === '90d') return addDays(today, -89);
  const first = entries.reduce<string | null>((min, e) => (!min || e.date < min ? e.date : min), null);
  return first && first < today ? first : addDays(today, -6);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000) + 1;
}

/** The number one day contributes to the chart. `null` = nothing logged. */
export function dayValue(key: TrackerKey, dayEntries: Entry[]): number | null {
  if (!dayEntries.length) return null;
  switch (key) {
    case 'water': {
      const oz = dayEntries.filter(isWater).reduce((a, e) => a + toOz(e.amount ?? 0, e.unit ?? 'oz'), 0);
      return oz ? Math.round(oz) : null;
    }
    case 'food':
      return dayEntries.length;
    case 'workout':
      return dayEntries.length;
    case 'sleep': {
      const m = dayEntries.reduce((a, e) => a + (e.minutes ?? 0), 0);
      return m ? Math.round((m / 60) * 10) / 10 : null;
    }
    case 'money':
      return dayEntries.reduce((a, e) => a + (e.money ?? 0), 0);
    case 'mood': {
      const m = dayEntries.map((e) => e.mood!);
      return Math.round((m.reduce((a, b) => a + b, 0) / m.length) * 10) / 10;
    }
    case 'award':
      return Math.round((dayEntries.reduce((a, e) => a + (e.minutes ?? 0), 0) / 60) * 10) / 10;
  }
}

export interface Bucket {
  key: string;
  label: string; // short axis label
  long: string; // readout label
  value: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const md = (day: string) => {
  const d = parseDay(day);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** Chart buckets: days for short ranges, weeks for long ones. Mood averages; the rest add up. */
export function buckets(key: TrackerKey, entries: Entry[], start: string, today: string): Bucket[] {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.date < start || e.date > today) continue;
    const arr = byDay.get(e.date) ?? [];
    arr.push(e);
    byDay.set(e.date, arr);
  }
  const n = daysBetween(start, today);
  const daily = n <= 31;
  const out: Bucket[] = [];
  if (daily) {
    for (let i = 0; i < n; i++) {
      const day = addDays(start, i);
      const d = parseDay(day);
      out.push({
        key: day,
        label: n <= 7 ? DOW[d.getDay()] : String(d.getDate()),
        long: md(day),
        value: dayValue(key, byDay.get(day) ?? []),
      });
    }
    return out;
  }
  // weekly buckets
  let ws = weekStart(start);
  while (ws <= today) {
    const vals: number[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(ws, i);
      if (day < start || day > today) continue;
      const v = dayValue(key, byDay.get(day) ?? []);
      if (v !== null) vals.push(v);
    }
    let value: number | null = null;
    if (vals.length) {
      value = key === 'mood' || key === 'sleep' ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0);
      value = Math.round(value * 10) / 10;
    }
    out.push({ key: ws, label: md(ws).split(' ')[1], long: `Week of ${md(ws)}`, value });
    ws = addDays(ws, 7);
  }
  return out;
}

/** Consecutive days with at least one entry, ending today (or yesterday if today is empty). */
export function streak(entries: Entry[], today: string, test: (dayEntries: Entry[]) => boolean = (d) => d.length > 0): number {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  let day = today;
  if (!test(byDay.get(day) ?? [])) day = addDays(day, -1);
  let count = 0;
  while (test(byDay.get(day) ?? [])) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export interface LiftRecord {
  name: string;
  sessions: number;
  bestWeight?: number;
  bestWeightReps?: number;
  bestE1rm?: number;
  lastDate: string;
  totalReps: number;
}

/** Personal records per exercise. Estimated 1-rep max uses the Epley formula. */
export function liftRecords(entries: Entry[]): LiftRecord[] {
  const map = new Map<string, LiftRecord>();
  for (const e of entries) {
    for (const l of e.lifts ?? []) {
      const key = l.name.trim().toLowerCase();
      if (!key) continue;
      const r = map.get(key) ?? { name: l.name.trim(), sessions: 0, lastDate: e.date, totalReps: 0 };
      r.sessions += 1;
      if (e.date > r.lastDate) r.lastDate = e.date;
      r.totalReps += (l.reps ?? 0) * (l.sets ?? 1);
      if (l.weight !== undefined && (r.bestWeight === undefined || l.weight > r.bestWeight)) {
        r.bestWeight = l.weight;
        r.bestWeightReps = l.reps;
      }
      if (l.weight && l.reps) {
        const e1 = l.reps > 1 ? l.weight * (1 + l.reps / 30) : l.weight;
        if (!r.bestE1rm || e1 > r.bestE1rm) r.bestE1rm = Math.round(e1);
      }
      map.set(key, r);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

/** Most repeated descriptions, e.g. favorite meals. */
export function topTexts(entries: Entry[], limit = 8): { text: string; count: number }[] {
  const map = new Map<string, { text: string; count: number }>();
  for (const e of entries) {
    const key = e.text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\b(for )?(breakfast|lunch|dinner|snack)\b/g, '').trim();
    if (!key) continue;
    const r = map.get(key) ?? { text: e.text.trim(), count: 0 };
    r.count += 1;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export interface GroupTotal {
  name: string;
  count: number;
  amount: number; // oz, dollars, or hours depending on tracker
  extra?: number; // money: spent
}

export function drinkKinds(entries: Entry[]): GroupTotal[] {
  const map = new Map<string, GroupTotal>();
  for (const e of entries) {
    const name = e.kind ?? (isWater(e) ? 'water' : 'other');
    const g = map.get(name) ?? { name, count: 0, amount: 0 };
    g.count += 1;
    if (e.unit !== 'drinks') g.amount += toOz(e.amount ?? 0, e.unit ?? 'oz');
    map.set(name, g);
  }
  return [...map.values()].map((g) => ({ ...g, amount: Math.round(g.amount) })).sort((a, b) => b.count - a.count);
}

export function moneySources(entries: Entry[]): GroupTotal[] {
  const map = new Map<string, GroupTotal>();
  for (const e of entries) {
    const name = e.kind ?? (e.category === 'money' ? 'other' : CATEGORIES[e.category].label.toLowerCase());
    const g = map.get(name) ?? { name, count: 0, amount: 0, extra: 0 };
    g.count += 1;
    if ((e.money ?? 0) >= 0) g.amount += e.money ?? 0;
    else g.extra = (g.extra ?? 0) - (e.money ?? 0);
    map.set(name, g);
  }
  return [...map.values()].sort((a, b) => b.amount + (b.extra ?? 0) - (a.amount + (a.extra ?? 0)));
}

export function awardByArea(entries: Entry[]): Record<AwardArea, number> {
  const t: Record<AwardArea, number> = { service: 0, personal: 0, fitness: 0, expedition: 0 };
  for (const e of entries) if (e.awardArea) t[e.awardArea] += (e.minutes ?? 0) / 60;
  for (const a of AWARD_ORDER) t[a] = Math.round(t[a] * 10) / 10;
  return t;
}

export function inRange(entries: Entry[], start: string, today: string) {
  return entries.filter((e) => e.date >= start && e.date <= today);
}

