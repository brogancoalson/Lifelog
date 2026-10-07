import { Platform } from 'react-native';
import type { Entry, Settings } from '../types';
import { toDay, toTime } from './dates';
import { callClaude, MODEL_FAST } from './claude';
import { buildParsePrompt, ENTRY_JSON_SCHEMA } from './parsePrompt';
import { quickParse } from './quickParse';
import { awardAreasIn, mentionsAward, stripAwardTag, taggable, tagCoversAll } from './awardTag';
import { withEstimate } from './nutrition';
import { normalizeEntry } from './storage';
import { detailLines, liftsFromLines } from './workout';
import { fitOnly, FIT_PROMPT } from './fit';
import { IS_FIT } from '../edition';

export type SortMode = 'ai-key' | 'ai-server' | 'ai-preview' | 'quick';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * The web preview published inside Claude can ask Claude directly (no API key).
 * This is only present in that preview, never in the phone app.
 */
export async function getPreviewSampler(): Promise<any | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const c = (window as any).claude;
  if (!c || typeof c.use !== 'function') return null;
  try {
    return await c.use('sample');
  } catch {
    return null;
  }
}

let samplerPromise: Promise<any | null> | null = null;
export function sampler() {
  if (!samplerPromise) samplerPromise = getPreviewSampler();
  return samplerPromise;
}

export async function detectSortMode(settings: Settings): Promise<SortMode> {
  if (settings.claudeKey) return 'ai-key';
  if (settings.aiEndpoint && settings.aiKey) return 'ai-server';
  if (await sampler()) return 'ai-preview';
  return 'quick';
}

export interface SortResult {
  entries: Entry[];
  mode: SortMode;
  fellBack?: string; // reason AI sorting failed and quick sort was used
}

/**
 * If they clearly named one Congressional Award area and the AI didn't tag anything,
 * tag the entry it most likely meant. Also keeps "goes towards personal" out of entry names.
 */
function awardSafetyNet(message: string, entries: Entry[]): Entry[] {
  for (const e of entries) if (mentionsAward(e.text)) e.text = stripAwardTag(e.text) || e.text;
  const areas = awardAreasIn(message);
  if (areas.length !== 1 || entries.some((e) => e.awardArea)) return entries;
  const candidates = entries.filter((e) => taggable(e.category));
  const targets = candidates.length === 1 || tagCoversAll(message) ? candidates : entries.length === 1 ? entries : [];
  for (const e of targets) e.awardArea = areas[0];
  return entries;
}

export async function sortMessage(message: string, settings: Settings): Promise<SortResult> {
  const res = await sortAll(message, settings);
  return { ...res, entries: fitOnly(res.entries) };
}

async function sortAll(message: string, settings: Settings): Promise<SortResult> {
  const now = new Date();
  const today = toDay(now);
  const time = toTime(now);
  const fallback: Partial<Entry> = { date: today, time, source: 'chat' };
  const finish = (raw: any[]) =>
    awardSafetyNet(
      message,
      (raw.map((r) => normalizeEntry({ ...r, source: 'chat' }, fallback)).filter(Boolean) as Entry[]).map((e) => {
        if (e.category !== 'workout') delete e.details;
        // the bullet lines still count toward lift records if the AI left "lifts" out
        else if (e.details && !e.lifts) {
          const lifts = liftsFromLines(detailLines(e.details));
          if (lifts.length) e.lifts = lifts;
        }
        return withEstimate(e);
      }),
    );

  const mode = await detectSortMode(settings);
  try {
    if (mode === 'ai-key') {
      const res = await callClaude({
        key: settings.claudeKey!,
        model: MODEL_FAST,
        system: (buildParsePrompt(today, WEEKDAYS[now.getDay()], time) + (IS_FIT ? FIT_PROMPT : '')),
        messages: [{ role: 'user', content: message }],
        tools: [{ name: 'save_entries', description: 'Save the structured life-log entries found in the message.', input_schema: ENTRY_JSON_SCHEMA as any }],
        toolChoice: { type: 'tool', name: 'save_entries' },
        maxTokens: 2000,
      });
      const use = res.content.find((c) => c.type === 'tool_use') as any;
      return { entries: finish(Array.isArray(use?.input?.entries) ? use.input.entries : []), mode };
    }
    if (mode === 'ai-server') {
      const res = await fetch(settings.aiEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.aiKey}`,
          apikey: settings.aiKey!,
        },
        body: JSON.stringify({ message, today, weekday: WEEKDAYS[now.getDay()], time }),
      });
      if (!res.ok) throw new Error(`Server said ${res.status}`);
      const json = await res.json();
      return { entries: finish(Array.isArray(json.entries) ? json.entries : []), mode };
    }
    if (mode === 'ai-preview') {
      const s = await sampler();
      const prompt =
        (buildParsePrompt(today, WEEKDAYS[now.getDay()], time) + (IS_FIT ? FIT_PROMPT : '')) +
        `\n\nRespond with JSON only, matching this schema:\n${JSON.stringify(ENTRY_JSON_SCHEMA)}\n\nMessage:\n"""${message}"""`;
      const json = await s.json(prompt, { modelTier: 'quick' });
      return { entries: finish(Array.isArray(json?.entries) ? json.entries : []), mode };
    }
  } catch (err: any) {
    return { entries: quickParse(message, now), mode: 'quick', fellBack: err?.message ?? 'AI sorting failed' };
  }
  return { entries: quickParse(message, now), mode: 'quick' };
}
