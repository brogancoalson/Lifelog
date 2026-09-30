import type { AppData, ChatMessage, Trade } from '../types';
import { sampler } from './aiParse';
import { callClaude, MODEL_SMART, textOf, type ContentBlock, type Msg } from './claude';
import { addDays, toDay, toTime, uid } from './dates';
import { DEFAULT_SYMBOL, normalizeTrade } from './storage';

/**
 * Trading journal: turn what the person wrote (and any screenshots) into a trade entry,
 * and reply like a trading coach would. Works offline with simple parsing.
 */

export const TRADE_SCHEMA = {
  type: 'object',
  properties: {
    is_trade: { type: 'boolean', description: 'true if this message describes a trade or a trading session to journal; false for a question' },
    date: { type: 'string', description: 'YYYY-MM-DD, default today' },
    time: { type: 'string', description: 'HH:MM 24h if stated' },
    symbol: { type: 'string', description: `e.g. MNQ, NQ, MES, ES. Default ${DEFAULT_SYMBOL}.` },
    direction: { type: 'string', enum: ['long', 'short'] },
    contracts: { type: 'number' },
    entry: { type: 'number', description: 'entry price' },
    exit: { type: 'number', description: 'exit price' },
    pnl: { type: 'number', description: 'profit or loss in dollars, negative for a loss' },
    setup: { type: 'string', description: 'short name of the setup, e.g. "opening range breakout"' },
    good: { type: 'string', description: 'what went well, in their words' },
    bad: { type: 'string', description: 'what went wrong or could improve, in their words' },
    emotion: { type: 'string', description: 'how they felt, if said' },
    notes: { type: 'string', description: 'a clean summary of everything they wrote about the trade and the market' },
    reply: { type: 'string', description: 'your 1-3 sentence response: one honest observation and one follow-up question. If it is a question, answer it.' },
  },
  required: ['is_trade', 'reply'],
} as const;

function systemPrompt(recent: Trade[]): string {
  const today = toDay();
  const lines = recent
    .slice(-15)
    .map((t) => `${t.date} ${t.symbol} ${t.direction ?? ''} ${t.pnl !== undefined ? `$${t.pnl}` : ''} ${t.setup ?? ''} | good: ${t.good ?? '-'} | bad: ${t.bad ?? '-'}`)
    .join('\n');
  return `You are the trading journal inside Lifelog. The user trades futures (mostly ${DEFAULT_SYMBOL}, micro Nasdaq, $2 per point) on a funded prop firm account.
Today is ${today}. When they describe a trade or session, pull out the details they gave (never invent prices or P&L) and save it.
If screenshots are attached, read the chart: the setup, where the entry and exit look to be, and the market context, and include what you see in "notes".
Reply briefly and honestly like a disciplined trading coach: one specific observation (risk, discipline, rule-following, emotion) and one follow-up question. No hype, no financial advice about what to trade next.
Recent trades for context:
${lines || '(none yet)'}`;
}

/** Offline parse: "long MNQ 2 contracts +$150, took the ORB, good patience, bad: moved my stop" */
export function quickTrade(text: string, now = new Date()): Partial<Trade> {
  const t = text.toLowerCase();
  const out: Partial<Trade> = {};
  const sym = text.match(/\b(MES|ES|MNQ|NQ|MYM|YM|M2K|RTY|CL|MCL|GC|MGC|SPY|QQQ)\b/i);
  out.symbol = sym ? sym[1].toUpperCase() : DEFAULT_SYMBOL;
  if (/\b(long|bought|buy|went long)\b/.test(t)) out.direction = 'long';
  else if (/\b(short|sold short|shorted|went short)\b/.test(t)) out.direction = 'short';
  const ct = t.match(/(\d+)\s*(contracts?|cons?|lots?|micros?)\b/);
  if (ct) out.contracts = +ct[1];
  const money = text.match(/([+-])?\s*\$\s?(\d[\d,]*(?:\.\d+)?)/);
  if (money) {
    const v = parseFloat(money[2].replace(/,/g, ''));
    const loss = money[1] === '-' || /\b(lost|loss|down|red|stopped out|stop out)\b/.test(t);
    out.pnl = loss ? -v : v;
  }
  const stop = '(?=[,;]?\\s*\\b(?:bad|mistakes?|went wrong|should(?:n\'t)? have|good|went well|did well)\\b|[.\\n]|$)';
  const good = text.match(new RegExp(`\\b(?:good|went well|did well)\\s*[:\\-]\\s*([^.\\n]+?)${stop}`, 'i'));
  const bad = text.match(new RegExp(`\\b(?:bad|mistakes?|went wrong|should have|shouldn't have)\\s*[:\\-]?\\s*([^.\\n]+?)${stop}`, 'i'));
  if (good) out.good = good[1].trim();
  if (bad) out.bad = bad[1].trim();
  if (/\byesterday\b/.test(t)) out.date = addDays(toDay(now), -1);
  return out;
}

export interface JournalResult {
  trade?: Trade;
  reply: string;
  mode: 'key' | 'preview' | 'quick';
}

export async function journalMessage(
  text: string,
  images: { id: string; base64: string }[],
  history: ChatMessage[],
  data: AppData,
): Promise<JournalResult> {
  const now = new Date();
  const fallback: Partial<Trade> = { date: toDay(now), time: toTime(now), symbol: DEFAULT_SYMBOL };
  const build = (raw: any) =>
    normalizeTrade({ ...raw, id: uid(), images: images.map((i) => i.id), notes: raw.notes || text, source: 'chat' }, fallback) ?? undefined;

  if (data.settings.claudeKey) {
    const prior: Msg[] = history
      .slice(-6)
      .map((m) => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text.trim() || (m.images?.length ? '(sent a screenshot)' : '(no text)') }) as Msg);
    while (prior.length && prior[0].role !== 'user') prior.shift();
    const content: ContentBlock[] = [
      ...images.map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg', data: i.base64 } })),
      { type: 'text', text: text || '(screenshot only)' },
    ];
    const res = await callClaude({
      key: data.settings.claudeKey,
      model: MODEL_SMART,
      system: systemPrompt(data.trades),
      messages: [...prior, { role: 'user', content }],
      tools: [{ name: 'journal', description: 'Save the journal entry and your reply.', input_schema: TRADE_SCHEMA as any }],
      toolChoice: { type: 'tool', name: 'journal' },
      maxTokens: 1500,
    });
    const use = res.content.find((c) => c.type === 'tool_use') as any;
    const input = use?.input ?? {};
    return { trade: input.is_trade !== false ? build(input) : undefined, reply: String(input.reply ?? textOf(res.content) ?? 'Saved.'), mode: 'key' };
  }

  const s = await sampler();
  if (s) {
    try {
      const prompt = `${systemPrompt(data.trades)}\n\nRespond with JSON only matching this schema:\n${JSON.stringify(TRADE_SCHEMA)}\n\nMessage:\n"""${text}"""${images.length ? `\n(${images.length} screenshot${images.length > 1 ? 's' : ''} attached; you can't see them here)` : ''}`;
      const input = await s.json(prompt, { modelTier: 'default' });
      return { trade: input?.is_trade !== false ? build(input) : undefined, reply: String(input?.reply ?? 'Saved to your journal.'), mode: 'preview' };
    } catch {
      // fall through to offline
    }
  }

  const q = quickTrade(text, now);
  const trade = build({ ...q, notes: text });
  const bits = [trade?.symbol, trade?.direction, trade?.pnl !== undefined ? `${trade.pnl >= 0 ? '+' : '−'}$${Math.abs(trade.pnl)}` : ''].filter(Boolean).join(' ');
  return {
    trade,
    reply: `Saved to your journal${bits ? `: ${bits}` : ''}${images.length ? ` with ${images.length} screenshot${images.length > 1 ? 's' : ''}` : ''}.${trade?.good && trade?.bad ? '' : ' Tap it to add what was good and bad.'}${' Add your Claude key in Settings to get coaching on each trade.'}`,
    mode: 'quick',
  };
}

export function tradeStats(trades: Trade[]) {
  const withPnl = trades.filter((t) => typeof t.pnl === 'number');
  const wins = withPnl.filter((t) => (t.pnl ?? 0) > 0);
  const losses = withPnl.filter((t) => (t.pnl ?? 0) < 0);
  const sum = (l: Trade[]) => l.reduce((a, t) => a + (t.pnl ?? 0), 0);
  return {
    count: trades.length,
    net: sum(withPnl),
    winRate: withPnl.length ? wins.length / withPnl.length : null,
    avgWin: wins.length ? sum(wins) / wins.length : null,
    avgLoss: losses.length ? sum(losses) / losses.length : null,
    best: withPnl.reduce<Trade | null>((b, t) => (!b || (t.pnl ?? 0) > (b.pnl ?? 0) ? t : b), null),
    worst: withPnl.reduce<Trade | null>((b, t) => (!b || (t.pnl ?? 0) < (b.pnl ?? 0) ? t : b), null),
  };
}
