import type { AwardArea, Entry, Goal } from '../types';
import { monthStart, weekStart } from './dates';

export interface DaySummary {
  waterOz: number;
  drinks: number;
  meals: number;
  calories: number;
  protein: number;
  workouts: number;
  activeMinutes: number;
  moneyIn: number;
  moneyOut: number;
  mood?: number;
  awardMinutes: number;
  business: number;
}

export const toOz = (amount = 0, unit = '') => {
  const u = unit.toLowerCase();
  if (u.startsWith('cup')) return amount * 8;
  if (u === 'l' || u.startsWith('liter') || u.startsWith('litre')) return amount * 33.8;
  if (u === 'ml') return amount / 29.57;
  if (u.startsWith('bottle')) return amount * 16.9;
  if (u.startsWith('gal')) return amount * 128;
  return amount; // assume oz
};

export function isWater(e: Entry) {
  return e.category === 'drink' && (e.kind === 'water' || /\bwater\b/i.test(e.text));
}

export function summarize(entries: Entry[]): DaySummary {
  const s: DaySummary = {
    waterOz: 0,
    drinks: 0,
    meals: 0,
    calories: 0,
    protein: 0,
    workouts: 0,
    activeMinutes: 0,
    moneyIn: 0,
    moneyOut: 0,
    awardMinutes: 0,
    business: 0,
  };
  const moods: number[] = [];
  for (const e of entries) {
    if (e.category === 'drink') {
      s.drinks += 1;
      if (isWater(e)) s.waterOz += toOz(e.amount ?? 0, e.unit ?? 'oz');
    }
    if (e.category === 'food') {
      s.meals += 1;
      s.calories += e.calories ?? 0;
      s.protein += e.protein ?? 0;
    }
    if (e.category === 'workout') {
      s.workouts += 1;
      s.activeMinutes += e.minutes ?? 0;
    }
    if (e.category === 'business') s.business += 1;
    if (typeof e.money === 'number') {
      if (e.money >= 0) s.moneyIn += e.money;
      else s.moneyOut += -e.money;
    }
    if (e.mood) moods.push(e.mood);
    if (e.awardArea) s.awardMinutes += e.minutes ?? 0;
  }
  if (moods.length) s.mood = moods.reduce((a, b) => a + b, 0) / moods.length;
  s.waterOz = Math.round(s.waterOz);
  return s;
}

export function awardTotals(entries: Entry[]): Record<AwardArea, number> {
  const t: Record<AwardArea, number> = { service: 0, personal: 0, fitness: 0, expedition: 0 };
  for (const e of entries) if (e.awardArea) t[e.awardArea] += (e.minutes ?? 0) / 60;
  return t;
}

export function periodStart(period: Goal['period'], today: string): string | null {
  if (period === 'day') return today;
  if (period === 'week') return weekStart(today);
  if (period === 'month') return monthStart(today);
  return null;
}

export function goalProgress(goal: Goal, entries: Entry[], today: string): number {
  if (goal.field === 'manual') return goal.manualProgress ?? 0;
  const start = periodStart(goal.period, today);
  const since = goal.period === 'all' ? goal.createdAt.slice(0, 10) : start;
  let total = 0;
  for (const e of entries) {
    if (since && e.date < since) continue;
    if (e.date > today) continue;
    if (goal.category && e.category !== goal.category) continue;
    if (goal.kind && e.kind !== goal.kind && !new RegExp(`\\b${escapeRe(goal.kind)}\\b`, 'i').test(e.text)) continue;
    switch (goal.field) {
      case 'count':
        total += 1;
        break;
      case 'minutes':
        total += e.minutes ?? 0;
        break;
      case 'amount':
        total += goal.kind === 'water' || goal.unit === 'oz' ? toOz(e.amount ?? 0, e.unit ?? 'oz') : e.amount ?? 0;
        break;
      case 'moneyIn':
        total += Math.max(0, e.money ?? 0);
        break;
      case 'moneyOut':
        total += Math.max(0, -(e.money ?? 0));
        break;
      case 'calories':
        total += e.calories ?? 0;
        break;
      case 'protein':
        total += e.protein ?? 0;
        break;
    }
  }
  if (goal.field === 'minutes' && /^h/i.test(goal.unit)) total = total / 60;
  return Math.round(total * 10) / 10;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1000 ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 }) : abs.toFixed(abs % 1 ? 2 : 0);
  return `$${s}`;
}

export function fmtHours(h: number): string {
  const r = Math.round(h * 10) / 10;
  return `${r % 1 ? r.toFixed(1) : r}`;
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  return rest ? `${h}h ${rest}m` : `${h}h`;
}
