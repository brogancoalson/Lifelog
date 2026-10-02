import type { Entry } from '../types';
import { addDays } from './dates';

/**
 * Compact summaries the Ask tab uses to give advice: which muscle groups and
 * lifts are getting trained (and which aren't), and eating habits.
 * Pure functions, no React Native, so they're easy to test.
 */

export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'biceps', 'triceps', 'core'] as const;
export type Group = (typeof MUSCLE_GROUPS)[number] | 'cardio' | 'other';

// Checked in order, so specific names ("leg curl", "tricep extension") win over general ones.
const GROUP_RULES: [Group, RegExp][] = [
  ['core', /\b(leg raises?|hanging raises?|planks?|crunch(es)?|sit ?ups?|abs?|core|russian twists?|ab wheel|obliques?)\b/],
  ['triceps', /\b(triceps?|skull ?crushers?|push ?downs?|close ?grip|dips?|kickbacks?)\b/],
  ['legs', /\b(squats?|leg press|lunges?|leg ext(ension)?s?|leg curls?|hamstrings?|quads?|rdls?|romanian|hip thrusts?|glutes?|calf|calves|step ?ups?|hack|bulgarian|leg day|legs)\b/],
  ['biceps', /\b(curls?|biceps?|hammer|preacher)\b/],
  ['shoulders', /\b(ohp|overhead|shoulders?|military|laterals?|lateral raises?|rear delts?|face ?pulls?|arnold|delts?|upright rows?)\b/],
  ['chest', /\b(bench|benched|chest|pecs?|fly|flyes|flies|push ?ups?|incline|decline|pec deck)\b/],
  ['back', /\b(deadlifts?|deads|rows?|pull ?ups?|chin ?ups?|lats?|pull ?downs?|shrugs?|back)\b/],
  ['cardio', /\b(run|ran|running|jog|jogging|miles?|bike|biking|cycling|swim|swam|swimming|walk|walked|walking|stairs?|stairmaster|elliptical|hike|hiked|hiking|sprints?|cardio|treadmill|rowing|erg)\b/],
];

export function muscleGroup(name: string): Group {
  const s = name.toLowerCase();
  for (const [g, re] of GROUP_RULES) if (re.test(s)) return g;
  return 'other';
}

/** Every group a phrase mentions: "chest, back and arms" -> chest, back, biceps, triceps. */
export function groupsIn(text: string): Group[] {
  const s = text.toLowerCase();
  const out = GROUP_RULES.filter(([, re]) => re.test(s)).map(([g]) => g);
  if (/\barms?\b/.test(s)) for (const g of ['biceps', 'triceps'] as const) if (!out.includes(g)) out.push(g);
  return out;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** Estimated one-rep max (Epley). */
const e1rm = (w: number, reps: number) => (reps <= 1 ? w : w * (1 + reps / 30));

interface LiftAcc {
  name: string;
  group: Group;
  dates: Set<string>;
  sets: number;
  last: string;
  best?: { weight: number; reps: number; date: string; e1rm: number };
  first?: { date: string; e1rm: number };
  latest?: { date: string; weight?: number; reps?: number; sets?: number; e1rm?: number };
}

export function trainingSummary(entries: Entry[], start: string, end: string, today: string) {
  const workouts = entries.filter((e) => e.category === 'workout');
  const lifts = new Map<string, LiftAcc>();
  const groupDates: Record<string, Set<string>> = {};
  const groupSets: Record<string, number> = {};
  const lastEver: Record<string, string> = {};
  const other: Record<string, { name: string; sessions: number; minutes: number; last: string }> = {};
  const workoutDays = new Set<string>();

  const touch = (g: Group, date: string, sets: number, inRange: boolean) => {
    if (!lastEver[g] || date > lastEver[g]) lastEver[g] = date;
    if (!inRange) return;
    (groupDates[g] ??= new Set()).add(date);
    groupSets[g] = (groupSets[g] ?? 0) + sets;
  };

  for (const e of [...workouts].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))) {
    const inRange = e.date >= start && e.date <= end;
    if (inRange) workoutDays.add(e.date);
    if (e.lifts?.length) {
      // lines without numbers ("Abs", "Cable crossovers") still mean that muscle got trained
      if (e.details) for (const g of new Set(e.details.split('\n').map((l) => muscleGroup(l)))) if (g !== 'other') touch(g, e.date, 0, inRange);
      for (const l of e.lifts) {
        const key = l.name.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!key) continue;
        const g = muscleGroup(key);
        const sets = l.sets ?? 1;
        touch(g, e.date, sets, inRange);
        if (!inRange) continue;
        const acc = lifts.get(key) ?? { name: l.name, group: g, dates: new Set<string>(), sets: 0, last: e.date };
        acc.dates.add(e.date);
        acc.sets += sets;
        acc.last = e.date;
        const est = l.weight && l.reps ? e1rm(l.weight, l.reps) : undefined;
        if (est !== undefined) {
          if (!acc.first) acc.first = { date: e.date, e1rm: est };
          if (!acc.best || est > acc.best.e1rm) acc.best = { weight: l.weight!, reps: l.reps!, date: e.date, e1rm: est };
        }
        acc.latest = { date: e.date, weight: l.weight, reps: l.reps, sets: l.sets, e1rm: est };
        lifts.set(key, acc);
      }
    } else if (e.details) {
      // written out with no lift numbers ("Cable flies", "Abs"): count each line's muscle group as trained that day
      const gs = new Set<Group>(e.details.split('\n').map((l) => muscleGroup(l)).filter((g) => g !== 'other'));
      if (!gs.size) gs.add(muscleGroup(`${e.kind ?? ''} ${e.text}`));
      for (const g of gs) touch(g, e.date, 0, inRange);
      if (!inRange) continue;
      const key = e.text.toLowerCase().trim();
      const o = (other[key] ??= { name: e.text, sessions: 0, minutes: 0, last: e.date });
      o.sessions += 1;
      o.minutes += e.minutes ?? 0;
      o.last = e.date;
    } else {
      const label = e.kind || e.text;
      const g = muscleGroup(`${e.kind ?? ''} ${e.text}`);
      touch(g, e.date, 0, inRange);
      if (!inRange) continue;
      const key = label.toLowerCase().trim();
      const o = (other[key] ??= { name: label, sessions: 0, minutes: 0, last: e.date });
      o.sessions += 1;
      o.minutes += e.minutes ?? 0;
      o.last = e.date;
    }
  }

  const groups = [...MUSCLE_GROUPS, 'cardio' as const].map((g) => {
    const last = lastEver[g];
    return {
      group: g,
      sessions_in_range: groupDates[g]?.size ?? 0,
      sets_in_range: groupSets[g] ?? 0,
      last_trained: last ?? null,
      days_since: last ? daysBetween(last, today) : null,
    };
  });

  const liftRows = [...lifts.values()]
    .sort((a, b) => b.dates.size - a.dates.size || b.last.localeCompare(a.last))
    .slice(0, 40)
    .map((l) => {
      const row: Record<string, unknown> = { lift: l.name, group: l.group, sessions: l.dates.size, total_sets: l.sets, last_done: l.last, days_since: daysBetween(l.last, today) };
      if (l.latest) row.last_session = { weight: l.latest.weight, reps: l.latest.reps, sets: l.latest.sets };
      if (l.best) row.best_set = { weight: l.best.weight, reps: l.best.reps, date: l.best.date, est_1rm: Math.round(l.best.e1rm) };
      if (l.first && l.latest?.e1rm !== undefined && l.dates.size > 1) row.est_1rm_change = Math.round(l.latest.e1rm - l.first.e1rm);
      return row;
    });

  return {
    start,
    end,
    workout_days: workoutDays.size,
    groups,
    lifts: liftRows,
    other_workouts: Object.values(other).map((o) => ({ ...o, minutes: Math.round(o.minutes) })),
    note: 'est_1rm uses the Epley formula. Groups come from lift names, so odd names may land in "other".',
  };
}

/** Daily averages, today so far, and the foods eaten most often (with their usual protein). */
export function nutritionSummary(entries: Entry[], today: string, days = 30) {
  const food = entries.filter((e) => e.category === 'food' || e.category === 'drink');
  // Averages use full days only (yesterday back), so a half-eaten today doesn't pull them down.
  const yesterday = addDays(today, -1);
  const window = (n: number) => {
    const from = addDays(today, -n);
    const list = food.filter((e) => e.date >= from && e.date <= yesterday);
    const byDay: Record<string, { cal: number; p: number; c: number }> = {};
    for (const e of list) {
      const d = (byDay[e.date] ??= { cal: 0, p: 0, c: 0 });
      d.cal += e.calories ?? 0;
      d.p += e.protein ?? 0;
      d.c += e.carbs ?? 0;
    }
    // only count days where food was actually logged, so empty days don't drag averages to zero
    const logged = Object.entries(byDay).filter(([, v]) => v.cal || v.p);
    const n2 = logged.length || 1;
    const sum = (k: 'cal' | 'p' | 'c') => logged.reduce((a, [, v]) => a + v[k], 0);
    return {
      days_with_food_logged: logged.length,
      avg_calories: Math.round(sum('cal') / n2),
      avg_protein_g: Math.round(sum('p') / n2),
      avg_carbs_g: Math.round(sum('c') / n2),
    };
  };

  const todayList = food.filter((e) => e.date === today);
  const todaySoFar = {
    calories: Math.round(todayList.reduce((a, e) => a + (e.calories ?? 0), 0)),
    protein_g: Math.round(todayList.reduce((a, e) => a + (e.protein ?? 0), 0)),
    carbs_g: Math.round(todayList.reduce((a, e) => a + (e.carbs ?? 0), 0)),
    items: todayList.map((e) => `${e.time ? `${e.time} ` : ''}${e.text}${e.protein ? ` (${e.protein}g protein)` : ''}`),
  };

  const from = addDays(today, -(days - 1));
  const counts: Record<string, { food: string; times: number; protein: number; calories: number; withNums: number }> = {};
  for (const e of food) {
    if (e.date < from) continue;
    const key = e.text.toLowerCase().trim();
    const c = (counts[key] ??= { food: e.text, times: 0, protein: 0, calories: 0, withNums: 0 });
    c.times += 1;
    if (e.protein || e.calories) {
      c.protein += e.protein ?? 0;
      c.calories += e.calories ?? 0;
      c.withNums += 1;
    }
  }
  const usual = Object.values(counts)
    .sort((a, b) => b.times - a.times)
    .slice(0, 25)
    .map((c) => ({
      food: c.food,
      times: c.times,
      usual_protein_g: c.withNums ? r1(c.protein / c.withNums) : null,
      usual_calories: c.withNums ? Math.round(c.calories / c.withNums) : null,
    }));

  return { today, today_so_far: todaySoFar, last_7_full_days: window(7), last_30_full_days: window(30), usual_foods: usual };
}
