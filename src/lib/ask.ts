import type { AppData, ChatMessage, Entry } from '../types';
import { callClaude, MODEL_SMART, runWithTools, type Msg, type ToolDef } from './claude';
import { addDays, isValidDay, toDay } from './dates';
import { moneyState } from './money';
import { awardTotals, goalProgress, isWater, toOz } from './stats';
import { sampler } from './aiParse';

/**
 * The Ask tab: Claude answers questions about everything in the app by
 * looking data up with tools. Nothing is sent except what it asks for.
 */

const TOOLS: ToolDef[] = [
  {
    name: 'overview',
    description: 'What data exists: date range, counts by category, buckets, goals, trades. Call this first when unsure what is logged.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'daily_summaries',
    description:
      'One summary row per day in a date range (max 370 days): water oz, meals, calories/protein/carbs, workouts and minutes, sleep hours and quality, mood average, money in/out, award hours, number of entries.',
    input_schema: {
      type: 'object',
      properties: { start_date: { type: 'string', description: 'YYYY-MM-DD' }, end_date: { type: 'string', description: 'YYYY-MM-DD' } },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'entries',
    description:
      'Individual log entries in a date range, optionally filtered by category (food, drink, workout, sleep, activity, business, social, mood, money, note) and/or a search word. Max 250 per call, newest first.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        category: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'money',
    description:
      'Money buckets (balance, amount per paycheck, spent), free money left over, paychecks and other income with how they were split, and spending by bucket in an optional date range.',
    input_schema: { type: 'object', properties: { start_date: { type: 'string' }, end_date: { type: 'string' } } },
  },
  {
    name: 'trades',
    description: 'Trading journal entries (symbol, long/short, contracts, P&L, setup, what was good/bad, emotions, notes) and stats in an optional date range.',
    input_schema: { type: 'object', properties: { start_date: { type: 'string' }, end_date: { type: 'string' } } },
  },
  {
    name: 'goals',
    description: 'Goals with current progress, and Congressional Award hours by area vs targets.',
    input_schema: { type: 'object', properties: {} },
  },
];

const r1 = (n: number) => Math.round(n * 10) / 10;

function range(input: any, fallbackDays = 30): [string, string] {
  const today = toDay();
  const end = isValidDay(input?.end_date) ? input.end_date : today;
  const start = isValidDay(input?.start_date) ? input.start_date : addDays(end, -(fallbackDays - 1));
  return start <= end ? [start, end] : [end, start];
}

function slimEntry(e: Entry) {
  const o: Record<string, unknown> = { date: e.date, category: e.category, text: e.text };
  if (e.time) o.time = e.time;
  if (e.minutes) o.minutes = e.minutes;
  if (e.amount !== undefined) o.amount = `${e.amount} ${e.unit ?? ''}`.trim();
  if (e.kind) o.kind = e.kind;
  if (e.calories) o.calories = e.calories;
  if (e.protein) o.protein_g = e.protein;
  if (e.carbs) o.carbs_g = e.carbs;
  if (e.nutritionEstimated) o.nutrition = 'estimated';
  if (typeof e.money === 'number') o.money = e.money;
  if (e.mood) o[e.category === 'sleep' ? 'sleep_quality_1_5' : 'mood_1_5'] = e.mood;
  if (e.lifts?.length) o.lifts = e.lifts;
  if (e.awardArea) o.award_area = e.awardArea;
  return o;
}

export function runTool(data: AppData, name: string, input: any): unknown {
  const today = toDay();
  if (name === 'overview') {
    const dates = data.entries.map((e) => e.date).sort();
    const counts: Record<string, number> = {};
    for (const e of data.entries) counts[e.category] = (counts[e.category] ?? 0) + 1;
    return {
      today,
      first_entry: dates[0] ?? null,
      last_entry: dates[dates.length - 1] ?? null,
      entries: data.entries.length,
      by_category: counts,
      trades: data.trades.length,
      buckets: data.buckets.map((b) => b.name),
      goals: data.goals.map((g) => g.title),
    };
  }
  if (name === 'daily_summaries') {
    const [start, end] = range(input);
    const days: Record<string, any> = {};
    for (const e of data.entries) {
      if (e.date < start || e.date > end) continue;
      const d = (days[e.date] ??= { date: e.date, entries: 0, water_oz: 0, meals: 0, calories: 0, protein_g: 0, carbs_g: 0, workouts: 0, workout_min: 0, sleep_hours: 0, money_in: 0, money_out: 0, award_hours: 0, moods: [] as number[], sleepQ: [] as number[] });
      d.entries += 1;
      if (e.category === 'drink' && isWater(e)) d.water_oz += toOz(e.amount ?? 0, e.unit ?? 'oz');
      if (e.category === 'food') d.meals += 1;
      if (e.category === 'food' || e.category === 'drink') {
        d.calories += e.calories ?? 0;
        d.protein_g += e.protein ?? 0;
        d.carbs_g += e.carbs ?? 0;
      }
      if (e.category === 'workout') {
        d.workouts += 1;
        d.workout_min += e.minutes ?? 0;
      }
      if (e.category === 'sleep') {
        d.sleep_hours += (e.minutes ?? 0) / 60;
        if (e.mood) d.sleepQ.push(e.mood);
      } else if (e.mood) d.moods.push(e.mood);
      if (typeof e.money === 'number') {
        if (e.money > 0) d.money_in += e.money;
        else d.money_out -= e.money;
      }
      if (e.awardArea) d.award_hours += (e.minutes ?? 0) / 60;
    }
    const rows = Object.values(days)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .slice(-370)
      .map((d: any) => {
        const o: Record<string, unknown> = { date: d.date, entries: d.entries };
        for (const k of ['water_oz', 'meals', 'calories', 'protein_g', 'carbs_g', 'workouts', 'workout_min', 'sleep_hours', 'money_in', 'money_out', 'award_hours']) if (d[k]) o[k] = r1(d[k]);
        if (d.moods.length) o.mood_avg = r1(d.moods.reduce((a: number, b: number) => a + b, 0) / d.moods.length);
        if (d.sleepQ.length) o.sleep_quality = r1(d.sleepQ.reduce((a: number, b: number) => a + b, 0) / d.sleepQ.length);
        return o;
      });
    return { start, end, days_with_data: rows.length, days: rows };
  }
  if (name === 'entries') {
    const [start, end] = range(input);
    const cat = typeof input?.category === 'string' ? input.category.toLowerCase() : null;
    const q = typeof input?.search === 'string' ? input.search.toLowerCase() : null;
    const limit = Math.min(250, Math.max(1, Number(input?.limit) || 150));
    const list = data.entries
      .filter((e) => e.date >= start && e.date <= end && (!cat || e.category === cat) && (!q || `${e.text} ${e.kind ?? ''}`.toLowerCase().includes(q)))
      .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
    return { start, end, total: list.length, returned: Math.min(limit, list.length), entries: list.slice(0, limit).map(slimEntry) };
  }
  if (name === 'money') {
    const st = moneyState(data);
    const names = new Map(data.buckets.map((b) => [b.id, b.name]));
    const [start, end] = input?.start_date || input?.end_date ? range(input) : ['0000-01-01', '9999-12-31'];
    const inRange = data.entries.filter((e) => typeof e.money === 'number' && e.date >= start && e.date <= end);
    const spendByBucket: Record<string, number> = {};
    for (const e of inRange) if ((e.money ?? 0) < 0) {
      const k = e.bucketId ? names.get(e.bucketId) ?? 'Free money' : 'Free money';
      spendByBucket[k] = r1((spendByBucket[k] ?? 0) - (e.money ?? 0));
    }
    return {
      free_money_left: st.free,
      buckets: st.buckets.map((b) => ({ name: b.bucket.name, type: b.bucket.kind, balance: b.balance, total_put_in: b.added, total_spent: b.spent, rule: `${b.bucket.rule} ${b.bucket.value}` })),
      pay_settings: data.settings.pay,
      income: inRange
        .filter((e) => (e.money ?? 0) > 0)
        .map((e) => ({ date: e.date, amount: e.money, source: e.text, kind: e.incomeKind ?? e.kind ?? 'income', split: (e.allocations ?? []).map((a) => ({ bucket: names.get(a.bucketId) ?? '(deleted)', amount: a.amount })) })),
      spending_by_bucket: spendByBucket,
      transfers: data.transfers.filter((t) => t.date >= start && t.date <= end).map((t) => ({ date: t.date, from: t.from === 'free' ? 'Free money' : names.get(t.from), to: t.to === 'free' ? 'Free money' : names.get(t.to), amount: t.amount })),
    };
  }
  if (name === 'trades') {
    const [start, end] = input?.start_date || input?.end_date ? range(input) : ['0000-01-01', '9999-12-31'];
    const list = data.trades.filter((t) => t.date >= start && t.date <= end).sort((a, b) => a.date.localeCompare(b.date));
    const withPnl = list.filter((t) => typeof t.pnl === 'number');
    const wins = withPnl.filter((t) => (t.pnl ?? 0) > 0);
    return {
      count: list.length,
      net_pnl: r1(withPnl.reduce((a, t) => a + (t.pnl ?? 0), 0)),
      win_rate: withPnl.length ? r1((wins.length / withPnl.length) * 100) : null,
      trades: list.map(({ images, createdAt, id, source, ...t }) => ({ ...t, screenshots: images.length })),
    };
  }
  if (name === 'goals') {
    const a = data.settings.award;
    const tot = awardTotals(data.entries);
    return {
      goals: data.goals.map((g) => ({ title: g.title, period: g.period, target: g.target, unit: g.unit, progress: goalProgress(g, data.entries, today) })),
      congressional_award: { level: a.level, started: a.startedOn ?? null, hours: { service: r1(tot.service), personal: r1(tot.personal), fitness: r1(tot.fitness), expedition_prep: r1(tot.expedition) }, targets: a.targets, expedition_done: a.expeditionDone },
    };
  }
  throw new Error(`Unknown tool ${name}`);
}

function systemPrompt(): string {
  const today = toDay();
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return `You are the Ask tab in Lifelog, a personal tracker. You answer questions about the user's own logged data.
Today is ${weekday}, ${today}. Use the tools to look things up. Never guess or invent numbers; if something isn't logged, say so plainly and say how to log it (for example "slept 7 hours" in the Log tab).
Write a clear, specific report: lead with the direct answer, then the key numbers, dates, best/worst days, and trends. Compare to earlier periods when useful.
Nutrition values marked "estimated" are averages; say "about" for them.
Format for a phone screen as plain text: short paragraphs, simple "- " bullets, and short headings in capital letters. No tables, no markdown symbols like ** or #.`;
}

export type AskMode = 'key' | 'preview' | 'none';

export async function askMode(data: AppData): Promise<AskMode> {
  if (data.settings.claudeKey) return 'key';
  if (await sampler()) return 'preview';
  return 'none';
}

export async function ask(question: string, history: ChatMessage[], data: AppData, onStep?: (s: string) => void): Promise<string> {
  const mode = await askMode(data);
  const prior: Msg[] = history
    .filter((m) => !m.undone)
    .slice(-8)
    .map((m) => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }));
  // the API needs turns to alternate and start with the user
  while (prior.length && prior[0].role !== 'user') prior.shift();
  const messages: Msg[] = [...prior, { role: 'user', content: question }];
  if (mode === 'key') {
    return runWithTools({
      key: data.settings.claudeKey!,
      model: MODEL_SMART,
      system: systemPrompt(),
      messages,
      tools: TOOLS,
      execute: (name, input) => runTool(data, name, input),
      onStep,
    });
  }
  if (mode === 'preview') {
    const s = await sampler();
    const turns = messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }));
    turns[turns.length - 1] = { role: 'user', content: `${systemPrompt()}\n\nQuestion: ${question}` };
    const res = await s(turns, {
      modelTier: 'default',
      cache: false,
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema,
        execute: (input: any) => {
          onStep?.(t.name);
          return runTool(data, t.name, input);
        },
      })),
    });
    return (res?.text ?? '').trim() || 'I couldn’t find an answer to that.';
  }
  throw new Error('NO_AI');
}

/** One quick check that the key works. */
export async function testKey(key: string): Promise<string> {
  const res = await callClaude({ key, model: 'claude-haiku-4-5-20251001', messages: [{ role: 'user', content: 'Reply with the word OK.' }], maxTokens: 5 });
  return res.content.length ? 'Connected' : 'Connected';
}
