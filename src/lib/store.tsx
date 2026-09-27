import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppData, ChatMessage, Entry, Goal, Settings } from '../types';
import { uid } from './dates';
import { emptyData, loadData, normalizeData, saveData } from './storage';

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
  addChat: (msg: Omit<ChatMessage, 'id' | 'createdAt'>) => string;
  updateChat: (id: string, patch: Partial<ChatMessage>) => void;
  replaceAll: (raw: unknown) => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setReady(true);
    });
  }, []);

  // Save shortly after any change (batched).
  useEffect(() => {
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveData(data).then((ok) => setSaveFailed(!ok));
    }, 300);
  }, [data, ready]);

  const addEntries = useCallback((entries: Entry[]) => {
    if (!entries.length) return;
    setData((d) => ({ ...d, entries: [...d.entries, ...entries] }));
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

  const addChat = useCallback((msg: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    const id = uid();
    setData((d) => ({
      ...d,
      chat: [...d.chat, { ...msg, id, createdAt: new Date().toISOString() }].slice(-100),
    }));
    return id;
  }, []);

  const updateChat = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setData((d) => ({ ...d, chat: d.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }, []);

  const replaceAll = useCallback((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).entries)) return false;
    setData(normalizeData(raw));
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
      replaceAll,
    }),
    [data, ready, saveFailed, addEntries, updateEntry, deleteEntries, upsertGoal, deleteGoal, updateSettings, addChat, updateChat, replaceAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
