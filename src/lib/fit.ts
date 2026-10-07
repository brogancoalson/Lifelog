import { IS_FIT } from '../edition';
import type { Entry } from '../types';

/**
 * The fit edition only tracks food, drinks, and workouts.
 * Walks, runs, classes, and sports count as workouts. Money, sleep, mood, and the rest are left out,
 * and so are Lifelog-only fields like award hours and spending buckets.
 * In Lifelog this changes nothing.
 */
export function fitOnly(entries: Entry[]): Entry[] {
  if (!IS_FIT) return entries;
  const out: Entry[] = [];
  for (const e of entries) {
    const category = e.category === 'activity' ? 'workout' : e.category;
    if (category !== 'food' && category !== 'drink' && category !== 'workout' && category !== 'note') continue;
    const { money, awardArea, validator, bucketId, allocations, incomeKind, mood, ...rest } = e;
    out.push({ ...rest, category });
  }
  return out;
}

/** Extra instructions for AI sorting in the fit edition. */
export const FIT_PROMPT = `

This person uses a simple food and workout tracker. Only log food, drinks, and workouts.
Walks, runs, hikes, classes (pilates, yoga, spin, barre), sports, and stretching are workouts.
Leave out money, sleep, mood, and anything else. Never log a price as its own entry.`;
