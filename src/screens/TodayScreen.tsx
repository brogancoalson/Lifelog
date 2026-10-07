import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { EntryEditor } from '../components/EntryEditor';
import { EntryRow } from '../components/EntryRow';
import { Body, Card, Empty, Icon, IconButton, Label } from '../components/ui';
import { CATEGORIES, MOOD_LABELS } from '../lib/categories';
import { addDays, prettyDay, toDay } from '../lib/dates';
import { fmtHours, fmtMinutes, fmtMoney, summarize } from '../lib/stats';
import { useStore } from '../lib/store';
import { font, radius, space, useInsets, useTheme, upper, ls, ds } from '../theme';
import { moneyState } from '../lib/money';
import { streak } from '../lib/trackers';
import { IS_FIT } from '../edition';
import type { TrackerKey } from '../lib/trackers';
import type { Entry } from '../types';

function Stat({
  icon,
  color,
  label,
  value,
  sub,
  onPress,
}: {
  icon: string;
  color: string;
  label: string;
  value: string;
  sub?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Open details.`}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: pressed ? t.surface2 : t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: pressed ? t.borderStrong : t.border,
        padding: space.md,
        gap: 6,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {IS_FIT ? (
          <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={15} color={color} />
          </View>
        ) : (
          <Icon name={icon} size={15} color={color} />
        )}
        <Text style={{ flex: 1, color: t.textDim, fontSize: 13, fontFamily: font.label, letterSpacing: ls(1.2), textTransform: upper }}>{label}</Text>
        <Icon name="chevron-forward" size={14} color={t.textFaint} />
      </View>
      <Text style={{ color: t.text, fontSize: ds(38), lineHeight: ds(40), fontFamily: font.display, letterSpacing: ls(0.5) }}>{value}</Text>
      {sub ? <Text style={{ color: t.textFaint, fontSize: 12 }}>{sub}</Text> : null}
    </Pressable>
  );
}

export function TodayScreen({
  onOpenSettings,
  onGoLog,
  onOpenTracker,
  onOpenTab,
  onOpenHistory,
}: {
  onOpenSettings: () => void;
  onGoLog: () => void;
  onOpenTracker: (key: TrackerKey) => void;
  onOpenTab: (tab: 'money' | 'trade') => void;
  onOpenHistory: () => void;
}) {
  const t = useTheme();
  const insets = useInsets();
  const { data, saveFailed } = useStore();
  const today = toDay();
  const [day, setDay] = useState(today);
  const [editing, setEditing] = useState<Entry | undefined>();
  const [adding, setAdding] = useState(false);

  const entries = useMemo(
    () =>
      data.entries
        .filter((e) => e.date === day)
        .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt.localeCompare(b.createdAt)),
    [data.entries, day],
  );
  const s = useMemo(() => summarize(entries), [entries]);
  const sleepEntries = entries.filter((e) => e.category === 'sleep');
  const sleepMin = sleepEntries.reduce((a, e) => a + (e.minutes ?? 0), 0);
  const sleepQ = sleepEntries.find((e) => e.mood)?.mood ?? 0;
  const dayTrades = data.trades.filter((tr) => tr.date === day);
  const dayPnl = dayTrades.reduce((a, tr) => a + (tr.pnl ?? 0), 0);
  const free = useMemo(() => moneyState(data).free, [data]);
  const net = s.moneyIn - s.moneyOut;
  const logStreak = useMemo(() => streak(data.entries, today), [data.entries, today]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, gap: space.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -10 }}>
            <IconButton icon="chevron-back" label="Previous day" onPress={() => setDay(addDays(day, -1))} />
            <Pressable onPress={() => setDay(today)} accessibilityRole="button" accessibilityLabel="Jump to today">
              <Text style={{ color: t.text, fontSize: ds(40), lineHeight: ds(42), fontFamily: font.display, letterSpacing: ls(1), textTransform: upper }}>{prettyDay(day, today)}</Text>
            </Pressable>
            <IconButton icon="chevron-forward" label="Next day" onPress={() => setDay(addDays(day, 1))} />
          </View>
          <View style={{ flexDirection: 'row', marginRight: -8 }}>
            <IconButton icon="time-outline" label="History" onPress={onOpenHistory} />
            <IconButton icon="settings-outline" label="Settings" onPress={onOpenSettings} />
          </View>
        </View>

        {saveFailed ? (
          <Card style={{ borderColor: t.danger }}>
            <Body style={{ color: t.danger }}>Couldn’t save to this device. Copy a backup from Settings before closing.</Body>
          </Card>
        ) : null}

        {IS_FIT ? (
          <Body dim style={{ marginTop: -8 }}>
            {logStreak > 1 ? `${logStreak} days in a row. Keep it up! 🔥` : day === today ? 'You’ve got this today ☀️' : ' '}
          </Body>
        ) : null}

        {IS_FIT ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Stat
              onPress={() => onOpenTracker('food')}
              icon="restaurant"
              color={CATEGORIES.food.color}
              label="Calories"
              value={s.calories ? String(Math.round(s.calories)) : '0'}
              sub={s.meals ? `${s.meals} meal${s.meals > 1 ? 's' : ''} logged` : 'No meals yet'}
            />
            <Stat
              onPress={() => onOpenTracker('food')}
              icon="egg"
              color="#E86FA8"
              label="Protein"
              value={`${Math.round(s.protein)}g`}
              sub={s.carbs ? `${Math.round(s.carbs)}g carbs` : undefined}
            />
            <Stat onPress={() => onOpenTracker('water')} icon="water" color={CATEGORIES.drink.color} label="Water" value={`${s.waterOz} oz`} sub={s.drinks ? `${s.drinks} drink${s.drinks > 1 ? 's' : ''} logged` : undefined} />
            <Stat
              onPress={() => onOpenTracker('workout')}
              icon="barbell"
              color={CATEGORIES.workout.color}
              label="Workouts"
              value={String(s.workouts)}
              sub={s.activeMinutes ? `${fmtMinutes(s.activeMinutes)} moving` : undefined}
            />
          </View>
        ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Stat onPress={() => onOpenTracker('water')} icon="water" color={CATEGORIES.drink.color} label="Water" value={`${s.waterOz} oz`} sub={s.drinks ? `${s.drinks} drink${s.drinks > 1 ? 's' : ''} logged` : undefined} />
            <Stat onPress={() => onOpenTracker('food')} icon="restaurant" color={CATEGORIES.food.color} label="Meals" value={String(s.meals)} sub={s.protein || s.carbs ? `${Math.round(s.protein)}g protein · ${Math.round(s.carbs)}g carbs` : s.calories ? `${Math.round(s.calories)} cal` : undefined} />
            <Stat
              onPress={() => onOpenTracker('workout')}
              icon="barbell"
              color={CATEGORIES.workout.color}
              label="Workouts"
              value={String(s.workouts)}
              sub={s.activeMinutes ? `${fmtMinutes(s.activeMinutes)} training` : undefined}
            />
            <Stat
              onPress={() => onOpenTracker('sleep')}
              icon="moon"
              color={CATEGORIES.sleep.color}
              label="Sleep"
              value={sleepMin ? `${fmtHours(sleepMin / 60)} hrs` : '—'}
              sub={sleepQ ? `Slept ${MOOD_LABELS[sleepQ].toLowerCase()}` : undefined}
            />
            <Stat
              onPress={() => onOpenTab('money')}
              icon="cash"
              color={CATEGORIES.money.color}
              label="Money"
              value={`${net < 0 ? '−' : ''}${fmtMoney(net)}`}
              sub={s.moneyIn || s.moneyOut ? `+${fmtMoney(s.moneyIn)} / −${fmtMoney(s.moneyOut)}` : undefined}
            />
            <Stat onPress={() => onOpenTracker('mood')} icon="happy" color={CATEGORIES.mood.color} label="Mood" value={s.mood ? MOOD_LABELS[Math.round(s.mood)] : '—'} />
            <Stat onPress={() => onOpenTracker('award')} icon="medal" color={t.accent} label="Award hrs" value={fmtHours(s.awardMinutes / 60)} sub={s.business ? `${s.business} business item${s.business > 1 ? 's' : ''}` : undefined} />
            <Stat
              onPress={() => onOpenTab('trade')}
              icon="trending-up"
              color={t.textDim}
              label="Trading"
              value={dayTrades.length ? `${dayPnl < 0 ? '−' : '+'}${fmtMoney(dayPnl)}` : '—'}
              sub={dayTrades.length ? `${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''} journaled` : undefined}
            />
            <Stat onPress={() => onOpenTab('money')} icon="wallet" color={CATEGORIES.money.color} label="Free money" value={`${free < 0 ? '−' : ''}${fmtMoney(free)}`} sub="left after buckets" />
          </View>
        )}

        <View style={{ gap: 4 }}>
          <Label>{day === today ? "Today's log" : 'Log'}</Label>
          {entries.length ? (
            <Card style={{ paddingVertical: 4 }}>
              {entries.map((e, i) => (
                <View key={e.id} style={i ? { borderTopWidth: 1, borderTopColor: t.border } : undefined}>
                  <EntryRow entry={e} onPress={() => setEditing(e)} />
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Empty
                icon="chatbubble-ellipses"
                title="Nothing logged yet"
                body={
                  day === today
                    ? IS_FIT
                      ? 'Tell the Log tab what you ate or how you moved, or tap + to add it by hand.'
                      : 'Tell the Log tab what you did, ate, spent, or how you feel.'
                    : 'Nothing was logged this day.'
                }
              />
              {day === today ? (
                <Pressable onPress={onGoLog} style={{ alignSelf: 'center', padding: 8 }}>
                  <Text style={{ color: t.accentInk, fontFamily: font.labelBold, fontSize: 16, letterSpacing: ls(1), textTransform: upper }}>Open Log</Text>
                </Pressable>
              ) : null}
            </Card>
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add an entry by hand"
        onPress={() => setAdding(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          right: space.lg,
          bottom: space.lg,
          width: 56,
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: t.accent,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Icon name="add" size={30} color={t.accentText} />
      </Pressable>

      <EntryEditor visible={!!editing} entry={editing} onClose={() => setEditing(undefined)} />
      <EntryEditor visible={adding} defaults={{ date: day }} onClose={() => setAdding(false)} />
    </View>
  );
}
