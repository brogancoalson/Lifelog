import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { AppData, Bucket, ChatMessage, Entry, Goal, Settings, Trade, Transfer } from '../types';
import { IS_FIT } from '../edition';
import { uid } from './dates';
import { matchBucket, starterBuckets, FREE } from './money';
import { estimateNutrition } from './nutrition';
import { emptyData, loadData, normalizeData, saveData } from './storage';

export type ChatKey = 'chat' | 'askChat' | 'tradeChat';
const CHAT_MAX: Record<ChatKey, number> = { chat: 100, askChat: 60, tradeChat: 100 };

interface Store {
  data: AppData;
  ready: boolean;
  saveFailed: boolean;
  addEntries: (entries: Entry[]) => void;
  updateEntry: (entry: Entry) => void;
  deleteEntries: (ids: string[]) => void;
  upsertGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addChat: (msg: Omit<ChatMessage, 'id' | 'createdAt'>, key?: ChatKey) => string;
  updateChat: (id: string, patch: Partial<ChatMessage>, key?: ChatKey) => void;
  clearChat: (key: ChatKey) => void;
  upsertBucket: (b: Bucket) => void;
  deleteBucket: (id: string) => void;
  moveBucket: (id: string, dir: -1 | 1) => void;
  addTransfer: (t: Transfer) => void;
  deleteTransfer: (id: string) => void;
  upsertTrade: (t: Trade) => void;
  deleteTrades: (ids: string[]) => void;
  replaceAll: (raw: unknown) => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // if the saved log couldn't be read, never save over it this session
  const [blockSave, setBlockSave] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData()
      .then((d) => {
        // first run with buckets: add the starter set once
        if (!IS_FIT && !d.settings.bucketsSeeded && d.buckets.length === 0) {
          d = { ...d, buckets: starterBuckets(), settings: { ...d.settings, bucketsSeeded: true } };
        }
        // Sept 30: Brogan puts $100 of every paycheck into his IRA. Switch his latte factor once, on his phone only
        // (the web version is what his buddy uses), and never again so later edits stick.
        if (!IS_FIT && !d.settings.latte100 && Platform.OS !== 'web') {
          d = {
            ...d,
            buckets: d.buckets.map((b) => (/latte factor/i.test(b.name) ? { ...b, rule: 'fixed' as const, value: 100 } : b)),
            settings: { ...d.settings, latte100: true },
          };
        }
        // Sept 30: food estimates were double counting fillings ("burrito with chicken, rice and beans") and
        // "a bowl of" anything. Redo the numbers the app estimated (never ones typed in), once.
        if (!d.settings.estimatesV3) {
          d = {
            ...d,
            entries: d.entries.map((e) => {
              if (!e.nutritionEstimated || (e.category !== 'food' && e.category !== 'drink')) return e;
              // "lunch" alone never had a real basis for numbers
              if (/^\s*(breakfast|lunch|dinner|brunch|snack|a snack|meal|a meal|dessert|food)\s*$/i.test(e.text)) {
                return { ...e, calories: undefined, protein: undefined, carbs: undefined, nutritionEstimated: undefined };
              }
              const est = estimateNutrition(e.text);
              return est ? { ...e, ...est } : e;
            }),
            settings: { ...d.settings, estimatesV3: true },
          };
        }
        // Oct 1: the circuit workout Brogan told Claude while his phone was put away. Added once, on his phone
        // only (the web version is his buddy's). If he'd already started logging it that day, fill that one in.
        if (!IS_FIT && !d.settings.circuitsOct1 && Platform.OS !== 'web') {
          const details = [
            'Full-body rollout with a lacrosse ball and roller',
            '90/90 stretches and spider stretches, then rolled out whatever was tight',
            'Circuit 1, 3 rounds: sled pulls starting at 2 plates, up a plate every round, then run to the mailboxes and back',
            '3 min break',
            'Circuit 2, 3 rounds: sled push to the tape and back, then burpee broad jumps all the way down',
            '25 unbroken wall balls',
            '3 min break',
            '25 unbroken wall balls',
          ].join('\n');
          const started = d.entries.find(
            (e) => e.category === 'workout' && e.date === '2026-10-01' && /circuit|sled|wall ?balls?|burpee|roll ?out|stretch/i.test(`${e.text} ${e.details ?? ''}`),
          );
          const entries: Entry[] = started
            ? d.entries.map((e) => (e === started ? { ...e, details } : e))
            : [...d.entries, { id: uid(), createdAt: '2026-10-02T03:19:00.000Z', date: '2026-10-01', category: 'workout', text: 'Circuits', details, source: 'manual' }];
          d = { ...d, entries, settings: { ...d.settings, circuitsOct1: true } };
        }
        setData(d);
        setReady(true);
      })
      .catch(() => {
        setBlockSave(true);
        setSaveFailed(true);
        setReady(true);
      });
  }, []);

  // Save shortly after any change (batched).
  useEffect(() => {
    if (!ready || blockSave) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveData(data).then((ok) => setSaveFailed(!ok));
    }, 300);
  }, [data, ready, blockSave]);

  const addEntries = useCallback((entries: Entry[]) => {
    if (!entries.length) return;
    setData((d) => {
      // spending with no bucket picked goes to the bucket its words match ("gas" -> Gas)
      const withBuckets = entries.map((e) =>
        typeof e.money === 'number' && e.money < 0 && !e.bucketId
          ? { ...e, bucketId: matchBucket(e.text, e.kind, d.buckets) }
          : e,
      );
      return { ...d, entries: [...d.entries, ...withBuckets] };
    });
  }, []);

  const updateEntry = useCallback((entry: Entry) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === entry.id ? entry : e)) }));
  }, []);

  const deleteEntries = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setData((d) => ({ ...d, entries: d.entries.filter((e) => !set.has(e.id)) }));
  }, []);

  const upsertGoal = useCallback((goal: Goal) => {
    setData((d) => {
      const exists = d.goals.some((g) => g.id === goal.id);
      return { ...d, goals: exists ? d.goals.map((g) => (g.id === goal.id ? goal : g)) : [...d.goals, goal] };
    });
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const addChat = useCallback((msg: Omit<ChatMessage, 'id' | 'createdAt'>, key: ChatKey = 'chat') => {
    const id = uid();
    setData((d) => ({
      ...d,
      [key]: [...d[key], { ...msg, id, createdAt: new Date().toISOString() }].slice(-CHAT_MAX[key]),
    }));
    return id;
  }, []);

  const updateChat = useCallback((id: string, patch: Partial<ChatMessage>, key: ChatKey = 'chat') => {
    setData((d) => ({ ...d, [key]: d[key].map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }, []);

  const clearChat = useCallback((key: ChatKey) => {
    setData((d) => ({ ...d, [key]: [] }));
  }, []);

  const upsertBucket = useCallback((b: Bucket) => {
    setData((d) => {
      const exists = d.buckets.some((x) => x.id === b.id);
      return { ...d, buckets: exists ? d.buckets.map((x) => (x.id === b.id ? b : x)) : [...d.buckets, b] };
    });
  }, []);

  const deleteBucket = useCallback((id: string) => {
    // spending and transfers that pointed at it fall back to free money
    setData((d) => ({
      ...d,
      buckets: d.buckets.filter((b) => b.id !== id),
      entries: d.entries.map((e) => (e.bucketId === id ? { ...e, bucketId: undefined } : e)),
      // a move between this bucket and another one now comes from / goes to free money, so the other bucket keeps it
      transfers: d.transfers
        .map((t) => (t.from === id ? { ...t, from: FREE } : t.to === id ? { ...t, to: FREE } : t))
        .filter((t) => t.from !== t.to),
    }));
  }, []);

  const moveBucket = useCallback((id: string, dir: -1 | 1) => {
    setData((d) => {
      const i = d.buckets.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.buckets.length) return d;
      const list = [...d.buckets];
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, buckets: list };
    });
  }, []);

  const addTransfer = useCallback((t: Transfer) => {
    setData((d) => ({ ...d, transfers: [...d.transfers, t] }));
  }, []);

  const deleteTransfer = useCallback((id: string) => {
    setData((d) => ({ ...d, transfers: d.transfers.filter((t) => t.id !== id) }));
  }, []);

  const upsertTrade = useCallback((t: Trade) => {
    setData((d) => {
      const exists = d.trades.some((x) => x.id === t.id);
      return { ...d, trades: exists ? d.trades.map((x) => (x.id === t.id ? t : x)) : [...d.trades, t] };
    });
  }, []);

  const deleteTrades = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setData((d) => ({ ...d, trades: d.trades.filter((t) => !set.has(t.id)) }));
  }, []);

  const replaceAll = useCallback((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).entries)) return false;
    // backups leave out the Claude key, so keep this device's key
    setData((d) => {
      const next = normalizeData(raw);
      return next.settings.claudeKey || !d.settings.claudeKey ? next : { ...next, settings: { ...next.settings, claudeKey: d.settings.claudeKey } };
    });
    return true;
  }, []);

  const value = useMemo<Store>(
    () => ({
      data,
      ready,
      saveFailed,
      addEntries,
      updateEntry,
      deleteEntries,
      upsertGoal,
      deleteGoal,
      updateSettings,
      addChat,
      updateChat,
      clearChat,
      upsertBucket,
      deleteBucket,
      moveBucket,
      addTransfer,
      deleteTransfer,
      upsertTrade,
      deleteTrades,
      replaceAll,
    }),
    [
      data,
      ready,
      saveFailed,
      addEntries,
      updateEntry,
      deleteEntries,
      upsertGoal,
      deleteGoal,
      updateSettings,
      addChat,
      updateChat,
      clearChat,
      upsertBucket,
      deleteBucket,
      moveBucket,
      addTransfer,
      deleteTransfer,
      upsertTrade,
      deleteTrades,
      replaceAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
