import type { Allocation, AppData, Bucket, Entry, PaySettings } from '../types';
import { uid } from './dates';

export const FREE = 'free';

/** Starter buckets. Latte factor = first hour of pay, every day, into retirement. */
export function starterBuckets(): Bucket[] {
  const now = new Date().toISOString();
  const b = (name: string, rule: Bucket['rule'], value: number, kind: Bucket['kind'], keywords: string[]): Bucket => ({
    id: uid(),
    name,
    rule,
    value,
    kind,
    keywords,
    createdAt: now,
  });
  return [
    b('Latte factor', 'daily', 20, 'save', ['latte factor', 'roth', 'ira', 'retirement']),
    b('Groceries', 'fixed', 0, 'spend', ['grocery', 'groceries', 'safeway', 'walmart', 'costco', 'trader joe', 'save mart', 'raley', 'winco', 'food 4 less']),
    b('Gas', 'fixed', 0, 'spend', ['gas', 'fuel', 'shell', 'chevron', 'arco', 'valero', '76', 'exxon']),
    b('Fun', 'fixed', 0, 'spend', ['fun', 'movie', 'movies', 'concert', 'game', 'games', 'golf', 'bowling', 'date', 'restaurant', 'eating out']),
    b('Insurance', 'fixed', 0, 'spend', ['insurance', 'geico', 'state farm', 'progressive', 'allstate']),
  ];
}

/** Gross pay for one paycheck from the pay settings ($20 × 5 h × 4 days × 2 weeks = $800). */
export function grossPaycheck(pay: PaySettings): number {
  return Math.round(pay.hourly * pay.hoursPerDay * pay.daysPerWeek * (pay.periodDays / 7) * 100) / 100;
}

export function ruleText(b: Bucket, pay: PaySettings): string {
  if (b.rule === 'daily') return `$${fmt(b.value)}/day × ${pay.periodDays} days = $${fmt(b.value * pay.periodDays)} per paycheck`;
  if (b.rule === 'percent') return `${fmt(b.value)}% of each paycheck`;
  return b.value ? `$${fmt(b.value)} per paycheck` : 'Set an amount per paycheck';
}

/** What a bucket asks for from one paycheck of `amount`. */
export function bucketWants(b: Bucket, amount: number, pay: PaySettings): number {
  if (b.rule === 'daily') return b.value * pay.periodDays;
  if (b.rule === 'percent') return (amount * b.value) / 100;
  return b.value;
}

/**
 * Split an income across buckets in list order. Buckets are filled in order until the money runs out,
 * so the ones at the top (latte factor) get paid first.
 */
export function planSplit(amount: number, buckets: Bucket[], pay: PaySettings): { allocations: Allocation[]; short: Record<string, number> } {
  let left = amount;
  const allocations: Allocation[] = [];
  const short: Record<string, number> = {};
  for (const b of buckets) {
    const want = round2(bucketWants(b, amount, pay));
    if (want <= 0) continue;
    const give = round2(Math.min(want, Math.max(0, left)));
    if (give < want) short[b.id] = round2(want - give);
    if (give > 0) allocations.push({ bucketId: b.id, amount: give });
    left = round2(left - give);
  }
  return { allocations, short };
}

export interface BucketState {
  bucket: Bucket;
  balance: number;
  added: number; // lifetime money put in
  spent: number; // lifetime money spent out of it
  lastAdded?: number; // from the most recent paycheck
}

export interface MoneyState {
  free: number;
  buckets: BucketState[];
  totalInBuckets: number;
  lastPaycheck?: Entry;
}

export function moneyState(data: AppData): MoneyState {
  const map = new Map<string, BucketState>();
  for (const b of data.buckets) map.set(b.id, { bucket: b, balance: b.start ?? 0, added: b.start ?? 0, spent: 0 });
  let free = data.settings.freeStart ?? 0;
  let lastPaycheck: Entry | undefined;
  for (const e of data.entries) {
    if (typeof e.money !== 'number' || e.money === 0) continue;
    if (e.money > 0) {
      let allocated = 0;
      for (const a of e.allocations ?? []) {
        const st = map.get(a.bucketId);
        if (!st) continue; // bucket was deleted: money falls back to free
        st.balance += a.amount;
        st.added += a.amount;
        allocated += a.amount;
      }
      free += e.money - allocated;
      if (e.incomeKind === 'paycheck' && (!lastPaycheck || e.date > lastPaycheck.date || (e.date === lastPaycheck.date && e.createdAt > lastPaycheck.createdAt))) lastPaycheck = e;
    } else {
      const st = e.bucketId ? map.get(e.bucketId) : undefined;
      if (st) {
        st.balance += e.money;
        st.spent -= e.money;
      } else free += e.money;
    }
  }
  for (const t of data.transfers) {
    const from = t.from === FREE ? null : map.get(t.from);
    const to = t.to === FREE ? null : map.get(t.to);
    if (t.from === FREE) free -= t.amount;
    else if (from) from.balance -= t.amount;
    if (t.to === FREE) free += t.amount;
    else if (to) to.balance += t.amount;
  }
  if (lastPaycheck) for (const a of lastPaycheck.allocations ?? []) {
    const st = map.get(a.bucketId);
    if (st) st.lastAdded = a.amount;
  }
  const buckets = data.buckets.map((b) => {
    const st = map.get(b.id)!;
    return { ...st, balance: round2(st.balance), added: round2(st.added), spent: round2(st.spent) };
  });
  return {
    free: round2(free),
    buckets,
    totalInBuckets: round2(buckets.reduce((a, b) => a + b.balance, 0)),
    lastPaycheck,
  };
}

/** Pick the bucket a purchase most likely came out of ("spent $14 on gas" -> Gas). */
export function matchBucket(text: string, kind: string | undefined, buckets: Bucket[]): string | undefined {
  const hay = ` ${`${text} ${kind ?? ''}`.toLowerCase()} `;
  let best: { id: string; len: number } | undefined;
  for (const b of buckets) {
    const words = [b.name.toLowerCase(), ...(b.keywords ?? [])];
    for (const w of words) {
      if (!w) continue;
      const re = new RegExp(`[^a-z0-9]${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z0-9]`);
      if (re.test(hay) && (!best || w.length > best.len)) best = { id: b.id, len: w.length };
    }
  }
  return best?.id;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmt(n: number) {
  const r = round2(n);
  return r % 1 ? r.toFixed(2) : String(r);
}
