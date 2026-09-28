import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { EntryEditor } from '../components/EntryEditor';
import { EntryRow } from '../components/EntryRow';
import { Body, Card, Empty, Icon, IconButton, Label } from '../components/ui';
import { CATEGORIES, MOOD_LABELS } from '../lib/categories';
import { addDays, prettyDay, toDay } from '../lib/dates';
import { fmtHours, fmtMinutes, fmtMoney, summarize } from '../lib/stats';
import { useStore } from '../lib/store';
import { font, radius, space, useInsets, useTheme } from '../theme';
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
        <Icon name={icon} size={15} color={color} />
        <Text style={{ flex: 1, color: t.textDim, fontSize: 13, fontFamily: font.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</Text>
        <Icon name="chevron-forward" size={14} color={t.textFaint} />
      </View>
      <Text style={{ color: t.text, fontSize: 38, lineHeight: 40, fontFamily: font.display, letterSpacing: 0.5 }}>{value}</Text>
      {sub ? <Text style={{ color: t.textFaint, fontSize: 12 }}>{sub}</Text> : null}
    </Pressable>
  );
}

export function TodayScreen({
  onOpenSettings,
  onGoLog,
  onOpenTracker,
}: {
  onOpenSettings: () => void;
  onGoLog: () => void;
  onOpenTracker: (key: TrackerKey) => void;
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
  const net = s.moneyIn - s.moneyOut;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, gap: space.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -10 }}>
            <IconButton icon="chevron-back" label="Previous day" onPress={() => setDay(addDays(day, -1))} />
            <Pressable onPress={() => setDay(today)} accessibilityRole="button" accessibilityLabel="Jump to today">
              <Text style={{ color: t.text, fontSize: 40, lineHeight: 42, fontFamily: font.display, letterSpacing: 1, textTransform: 'uppercase' }}>{prettyDay(day, today)}</Text>
            </Pressable>
            <IconButton icon="chevron-forward" label="Next day" onPress={() => setDay(addDays(day, 1))} />
          </View>
          <IconButton icon="settings-outline" label="Settings" onPress={onOpenSettings} />
        </View>

        {saveFailed ? (
          <Card style={{ borderColor: t.danger }}>
            <Body style={{ color: t.danger }}>Couldn’t save to this device. Copy a backup from Settings before closing.</Body>
          </Card>
        ) : null}

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
            onPress={() => onOpenTracker('money')}
            icon="cash"
            color={CATEGORIES.money.color}
            label="Money"
            value={`${net < 0 ? '−' : ''}${fmtMoney(net)}`}
            sub={s.moneyIn || s.moneyOut ? `+${fmtMoney(s.moneyIn)} / −${fmtMoney(s.moneyOut)}` : undefined}
          />
          <Stat onPress={() => onOpenTracker('mood')} icon="happy" color={CATEGORIES.mood.color} label="Mood" value={s.mood ? MOOD_LABELS[Math.round(s.mood)] : '—'} />
          <Stat onPress={() => onOpenTracker('award')} icon="medal" color={t.accent} label="Award hrs" value={fmtHours(s.awardMinutes / 60)} sub={s.business ? `${s.business} business item${s.business > 1 ? 's' : ''}` : undefined} />
        </View>

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
                body={day === today ? 'Tell the Log tab what you did, ate, spent, or how you feel.' : 'Nothing was logged this day.'}
              />
              {day === today ? (
                <Pressable onPress={onGoLog} style={{ alignSelf: 'center', padding: 8 }}>
                  <Text style={{ color: t.accent, fontFamily: font.labelBold, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' }}>Open Log</Text>
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
          borderRadius: 0,
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
