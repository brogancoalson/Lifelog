import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart } from '../components/BarChart';
import { EntryDetail } from '../components/EntryDetail';
import { EntryEditor } from '../components/EntryEditor';
import { Button, Card, Chip, Empty, Icon, IconButton, Label, ProgressBar } from '../components/ui';
import { awardExport } from '../lib/award';
import { AWARD_AREAS, AWARD_ORDER, MOOD_LABELS } from '../lib/categories';
import { prettyDay, toDay } from '../lib/dates';
import { shareText } from '../lib/share';
import { fmtHours, fmtMinutes, fmtMoney, isWater, toOz } from '../lib/stats';
import { useStore } from '../lib/store';
import {
  awardByArea,
  buckets,
  dayValue,
  daysBetween,
  drinkKinds,
  inRange,
  liftRecords,
  moneySources,
  RangeKey,
  RANGES,
  rangeStart,
  streak,
  topTexts,
  TrackerKey,
  TRACKERS,
  trackerEntries,
} from '../lib/trackers';
import { font, space, useInsets, useTheme, upper, ls, ds, radius } from '../theme';
import type { Category, Entry } from '../types';

interface Stat {
  label: string;
  value: string;
  sub?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const daysText = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
const signed = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${fmtMoney(n)}`;

function StatGrid({ stats }: { stats: Stat[] }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {stats.map((s) => (
        <View key={s.label} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: radius.lg, padding: space.md, gap: 2 }}>
          <Text style={{ color: t.textDim, fontSize: 13, fontFamily: font.label, letterSpacing: ls(1.2), textTransform: upper }}>{s.label}</Text>
          <Text style={{ color: t.text, fontSize: ds(32), lineHeight: ds(34), fontFamily: font.display, letterSpacing: ls(0.5) }} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
          {s.sub ? (
            <Text style={{ color: t.textFaint, fontSize: 12 }} numberOfLines={2}>
              {s.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** A labeled row with a proportional bar, used for breakdowns. */
function BreakdownRow({ name, value, fraction, color }: { name: string; value: string; fraction: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 5, paddingVertical: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: t.text, fontSize: 15, fontFamily: font.label, letterSpacing: ls(0.6), textTransform: upper, flexShrink: 1 }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: t.textDim, fontSize: 14 }}>{value}</Text>
      </View>
      <ProgressBar value={fraction} color={color} height={6} />
    </View>
  );
}

const DEFAULT_CATEGORY: Record<TrackerKey, Category> = {
  water: 'drink',
  food: 'food',
  workout: 'workout',
  sleep: 'sleep',
  money: 'money',
  mood: 'mood',
  award: 'activity',
};

export function TrackerScreen({ tracker, onBack, top }: { tracker: TrackerKey; onBack?: () => void; top?: React.ReactNode }) {
  const t = useTheme();
  const insets = useInsets();
  const { data } = useStore();
  const [range, setRange] = useState<RangeKey>('7d');
  const [editing, setEditing] = useState<Entry | undefined>();
  const [adding, setAdding] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const meta = TRACKERS[tracker];
  const color = meta.color === 'accent' ? t.accent : meta.color;
  const today = toDay();

  const all = useMemo(() => trackerEntries(tracker, data.entries), [tracker, data.entries]);
  const start = rangeStart(range, today, all);
  const days = daysBetween(start, today);
  const list = useMemo(() => inRange(all, start, today), [all, start, today]);
  const chart = useMemo(() => buckets(tracker, all, start, today), [tracker, all, start, today]);

  // per-day values across the range (for best/lowest day)
  const perDay = useMemo(() => {
    const byDay = new Map<string, Entry[]>();
    for (const e of list) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    return [...byDay.entries()].map(([day, es]) => ({ day, value: dayValue(tracker, es) })).filter((d) => d.value !== null) as {
      day: string;
      value: number;
    }[];
  }, [list, tracker]);

  const best = perDay.reduce<{ day: string; value: number } | null>((b, d) => (!b || d.value > b.value ? d : b), null);
  const worst = perDay.reduce<{ day: string; value: number } | null>((b, d) => (!b || d.value < b.value ? d : b), null);
  const rangeLabel = range === 'all' ? `Since ${prettyDay(start, today)}` : `Last ${days} days`;

  let stats: Stat[] = [];
  let format: (v: number) => string = (v) => String(v);
  let breakdown: React.ReactNode = null;

  if (tracker === 'water') {
    format = (v) => `${Math.round(v)} oz`;
    const oz = Math.round(list.filter(isWater).reduce((a, e) => a + toOz(e.amount ?? 0, e.unit ?? 'oz'), 0));
    const waterDays = perDay.length;
    const goal = data.goals.find((g) => g.category === 'drink' && g.kind === 'water' && g.period === 'day');
    stats = [
      { label: 'Total water', value: `${oz} oz` },
      { label: 'Daily average', value: `${Math.round(oz / days)} oz`, sub: `over ${days} days` },
      { label: 'Best day', value: best ? `${best.value} oz` : '—', sub: best ? prettyDay(best.day, today) : undefined },
      { label: 'Days with water', value: `${waterDays}/${days}` },
      { label: 'Streak', value: daysText(streak(all, today, (d) => d.some(isWater))) },
      goal
        ? { label: 'Days at goal', value: `${perDay.filter((d) => d.value >= goal.target).length}`, sub: `goal: ${goal.target} ${goal.unit}` }
        : { label: 'Drinks logged', value: String(list.length) },
    ];
    const kinds = drinkKinds(list);
    const maxCount = Math.max(1, ...kinds.map((k) => k.count));
    breakdown = kinds.length ? (
      <Section title="By drink">
        {kinds.map((k) => (
          <BreakdownRow key={k.name} name={k.name} value={`${k.count}×${k.amount ? ` · ${k.amount} oz` : ''}`} fraction={k.count / maxCount} color={color} />
        ))}
      </Section>
    ) : null;
  }

  if (tracker === 'food') {
    format = (v) => `${v} meal${v === 1 ? '' : 's'}`;
    // nutrition counts food and drinks (protein shakes, milk, soda...)
    const intake = inRange(data.entries, start, today).filter((e) => e.category === 'food' || e.category === 'drink');
    const cal = intake.reduce((a, e) => a + (e.calories ?? 0), 0);
    const pro = intake.reduce((a, e) => a + (e.protein ?? 0), 0);
    const carb = intake.reduce((a, e) => a + (e.carbs ?? 0), 0);
    const nDays = new Set(intake.filter((e) => e.calories || e.protein || e.carbs).map((e) => e.date)).size;
    const est = intake.some((e) => e.nutritionEstimated) ? '~' : '';
    const perDayAvg = (v: number, unit: string) => (nDays ? `${est}${Math.round(v / nDays).toLocaleString('en-US')}${unit} a day, over ${nDays} day${nDays > 1 ? 's' : ''}` : 'log food to see this');
    stats = [
      { label: 'Meals', value: String(list.length), sub: `${round1(list.length / days)} per day` },
      { label: 'Days logged', value: `${perDay.length}/${days}` },
      { label: 'Protein', value: pro ? `${est}${Math.round(pro)} g` : '—', sub: perDayAvg(pro, ' g') },
      { label: 'Carbs', value: carb ? `${est}${Math.round(carb)} g` : '—', sub: perDayAvg(carb, ' g') },
      { label: 'Calories', value: cal ? `${est}${Math.round(cal).toLocaleString('en-US')}` : '—', sub: perDayAvg(cal, '') },
      { label: 'Streak', value: daysText(streak(all, today)) },
    ];
    const top = topTexts(list);
    const maxCount = Math.max(1, ...top.map((k) => k.count));
    breakdown = top.length ? (
      <Section title="What you eat most">
        {top.map((k) => (
          <BreakdownRow key={k.text} name={k.text} value={`${k.count}×`} fraction={k.count / maxCount} color={color} />
        ))}
      </Section>
    ) : null;
  }

  if (tracker === 'workout') {
    format = (v) => `${v} workout${v === 1 ? '' : 's'}`;
    const minutes = list.reduce((a, e) => a + (e.minutes ?? 0), 0);
    const miles = round1(list.filter((e) => e.unit === 'miles').reduce((a, e) => a + (e.amount ?? 0), 0));
    stats = [
      { label: 'Workouts', value: String(list.length) },
      { label: 'Time trained', value: minutes ? fmtMinutes(minutes) : '—', sub: minutes ? `${Math.round(minutes / Math.max(1, list.length))} min avg` : 'add minutes when you log' },
      { label: 'Per week', value: String(round1(list.length / (days / 7))) },
      { label: 'Days trained', value: `${perDay.length}/${days}` },
      { label: 'Streak', value: daysText(streak(all, today)) },
      { label: 'Distance', value: miles ? `${miles} mi` : '—' },
    ];
    const records = liftRecords(all);
    breakdown = records.length ? (
      <Section title="Lifts and records (all time)">
        {records.map((r) => (
          <View key={r.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontFamily: font.labelBold, letterSpacing: ls(0.6), textTransform: upper }}>{r.name}</Text>
              <Text style={{ color: t.textFaint, fontSize: 12 }}>
                {r.sessions} time{r.sessions > 1 ? 's' : ''} · last {prettyDay(r.lastDate, today).toLowerCase()}
                {r.totalReps ? ` · ${r.totalReps} reps total` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: t.text, fontSize: ds(22), fontFamily: font.display, letterSpacing: ls(0.5) }}>
                {r.bestWeight !== undefined ? `${r.bestWeight}${r.bestWeightReps ? ` × ${r.bestWeightReps}` : ''}` : '—'}
              </Text>
              {r.bestE1rm ? <Text style={{ color: t.textFaint, fontSize: 12 }}>est. max {r.bestE1rm} lbs</Text> : null}
            </View>
          </View>
        ))}
      </Section>
    ) : null;
  }

  if (tracker === 'money') {
    format = (v) => signed(v);
    const made = list.reduce((a, e) => a + Math.max(0, e.money ?? 0), 0);
    const spent = list.reduce((a, e) => a + Math.max(0, -(e.money ?? 0)), 0);
    const bigIn = list.reduce<Entry | null>((b, e) => ((e.money ?? 0) > 0 && (!b || (e.money ?? 0) > (b.money ?? 0)) ? e : b), null);
    const bigOut = list.reduce<Entry | null>((b, e) => ((e.money ?? 0) < 0 && (!b || (e.money ?? 0) < (b.money ?? 0)) ? e : b), null);
    stats = [
      { label: 'Net', value: signed(made - spent) },
      { label: 'Per day', value: signed(Math.round((made - spent) / days)), sub: `over ${days} days` },
      { label: 'Made', value: fmtMoney(made) },
      { label: 'Spent', value: fmtMoney(spent) },
      { label: 'Biggest in', value: bigIn ? fmtMoney(bigIn.money!) : '—', sub: bigIn?.text },
      { label: 'Biggest out', value: bigOut ? fmtMoney(bigOut.money!) : '—', sub: bigOut?.text },
    ];
    const sources = moneySources(list);
    const maxAmt = Math.max(1, ...sources.map((s) => s.amount + (s.extra ?? 0)));
    breakdown = sources.length ? (
      <Section title="By source">
        {sources.map((s) => (
          <BreakdownRow
            key={s.name}
            name={s.name}
            value={[s.amount ? `+${fmtMoney(s.amount)}` : '', s.extra ? `−${fmtMoney(s.extra)}` : ''].filter(Boolean).join(' / ')}
            fraction={(s.amount + (s.extra ?? 0)) / maxAmt}
            color={s.amount >= (s.extra ?? 0) ? t.good : t.danger}
          />
        ))}
      </Section>
    ) : null;
  }

  if (tracker === 'sleep') {
    format = (v) => `${fmtHours(v)} hrs`;
    const nights = perDay.length;
    const hours = perDay.map((d) => d.value);
    const avg = nights ? hours.reduce((a, b) => a + b, 0) / nights : 0;
    const quality = list.filter((e) => e.mood).map((e) => e.mood!);
    const qAvg = quality.length ? quality.reduce((a, b) => a + b, 0) / quality.length : 0;
    const naps = list.filter((e) => /nap/i.test(e.text)).length;
    stats = [
      { label: 'Average', value: nights ? `${fmtHours(avg)} hrs` : '—', sub: nights ? `over ${nights} night${nights > 1 ? 's' : ''}` : 'log “slept 7 hours”' },
      { label: 'Nights logged', value: `${nights}/${days}` },
      { label: 'Best night', value: best ? `${fmtHours(best.value)} hrs` : '—', sub: best ? prettyDay(best.day, today) : undefined },
      { label: 'Worst night', value: worst ? `${fmtHours(worst.value)} hrs` : '—', sub: worst ? prettyDay(worst.day, today) : undefined },
      { label: '7+ hours', value: `${hours.filter((h) => h >= 7).length} night${hours.filter((h) => h >= 7).length === 1 ? '' : 's'}` },
      { label: 'Quality', value: qAvg ? MOOD_LABELS[Math.round(qAvg)] : '—', sub: naps ? `${naps} nap${naps > 1 ? 's' : ''}` : quality.length ? `${quality.length} rated` : 'say “slept great” or “slept rough”' },
    ];
  }

  if (tracker === 'mood') {
    format = (v) => `${v} · ${MOOD_LABELS[Math.round(v)] ?? ''}`;
    const moods = list.map((e) => e.mood!);
    const avg = moods.length ? round1(moods.reduce((a, b) => a + b, 0) / moods.length) : 0;
    const counts = [1, 2, 3, 4, 5].map((m) => moods.filter((x) => x === m).length);
    const common = moods.length ? counts.indexOf(Math.max(...counts)) + 1 : 0;
    stats = [
      { label: 'Average', value: avg ? MOOD_LABELS[Math.round(avg)] : '—', sub: avg ? `${avg} of 5` : undefined },
      { label: 'Check-ins', value: String(moods.length) },
      { label: 'Best day', value: best ? MOOD_LABELS[Math.round(best.value)] : '—', sub: best ? prettyDay(best.day, today) : undefined },
      { label: 'Lowest day', value: worst ? MOOD_LABELS[Math.round(worst.value)] : '—', sub: worst ? prettyDay(worst.day, today) : undefined },
      { label: 'Most common', value: common ? MOOD_LABELS[common] : '—' },
      { label: 'Streak', value: daysText(streak(all, today)) },
    ];
    const maxCount = Math.max(1, ...counts);
    breakdown = moods.length ? (
      <Section title="How often you felt">
        {[5, 4, 3, 2, 1].map((m) => (
          <BreakdownRow key={m} name={`${m} · ${MOOD_LABELS[m]}`} value={`${counts[m - 1]}×`} fraction={counts[m - 1] / maxCount} color={color} />
        ))}
      </Section>
    ) : null;
  }

  if (tracker === 'award') {
    format = (v) => `${fmtHours(v)} hrs`;
    const byArea = awardByArea(list);
    const allTime = awardByArea(all);
    const hours = AWARD_ORDER.reduce((a, k) => a + byArea[k], 0);
    const missing = all.filter((e) => !e.validator).length;
    const targets = data.settings.award.targets;
    stats = [
      { label: 'Hours', value: fmtHours(hours), sub: rangeLabel.toLowerCase() },
      { label: 'Per week', value: fmtHours(hours / (days / 7)) },
      { label: 'Entries', value: String(list.length) },
      { label: 'Need validator', value: String(missing), sub: 'all time' },
    ];
    breakdown = (
      <Section title="Toward your medal (all time)">
        {AWARD_ORDER.filter((a) => a !== 'expedition' || allTime.expedition > 0).map((a) => (
          <BreakdownRow
            key={a}
            name={AWARD_AREAS[a].short}
            value={`${fmtHours(allTime[a])}${targets[a] ? ` / ${targets[a]}` : ''} hrs${byArea[a] ? ` (+${fmtHours(byArea[a])})` : ''}`}
            fraction={targets[a] ? allTime[a] / targets[a] : 0}
            color={color}
          />
        ))}
        <Button
          small
          variant="secondary"
          icon="share-outline"
          title={exportNote || 'Export log for validator'}
          style={{ marginTop: 8 }}
          onPress={async () => {
            const r = await shareText(awardExport(data), 'Congressional Award log');
            setExportNote(r === 'copied' ? 'Copied' : r === 'failed' ? "Couldn't export" : '');
            if (r !== 'shared') setTimeout(() => setExportNote(''), 2000);
          }}
        />
      </Section>
    );
  }

  // full log grouped by day, newest first
  const groups = useMemo(() => {
    const byDay = new Map<string, Entry[]>();
    for (const e of list) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, es]) => ({ day, entries: es.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? '')), value: dayValue(tracker, es) }));
  }, [list, tracker]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.sm, gap: space.lg, paddingBottom: 110 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: onBack ? -10 : 0 }}>
          {onBack ? <IconButton icon="chevron-back" label="Back to Today" onPress={onBack} size={26} /> : null}
          <Icon name={meta.icon} size={22} color={color} />
          <Text style={{ color: t.text, fontSize: ds(40), lineHeight: ds(42), fontFamily: font.display, letterSpacing: ls(1), textTransform: upper, marginLeft: 6 }}>
            {meta.title}
          </Text>
        </View>

        {top}

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {RANGES.map((r) => (
              <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} color={t.accent} />
            ))}
          </View>
          <Text style={{ color: t.textFaint, fontSize: 12, fontFamily: font.label, letterSpacing: ls(1), textTransform: upper }}>
            {rangeLabel} · {prettyDay(start, today)} to today
          </Text>
        </View>

        <StatGrid stats={stats} />

        <Card style={{ gap: 10 }}>
          <Label>{meta.chartTitle}</Label>
          <BarChart key={`${tracker}-${range}`} data={chart} color={color} negativeColor={t.danger} format={format} />
        </Card>

        {breakdown}

        <View style={{ gap: space.sm }}>
          <Label>
            Every entry · {list.length}
          </Label>
          {groups.length ? (
            groups.map((g) => (
              <View key={g.day} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8 }}>
                  <Text style={{ color: t.text, fontSize: 19, fontFamily: font.labelBold, letterSpacing: ls(1), textTransform: upper }}>
                    {prettyDay(g.day, today)}
                  </Text>
                  {g.value !== null ? <Text style={{ color: t.textDim, fontSize: 13 }}>{format(g.value)}</Text> : null}
                </View>
                {g.entries.map((e) => (
                  <EntryDetail key={e.id} entry={e} onPress={() => setEditing(e)} />
                ))}
              </View>
            ))
          ) : (
            <Card>
              <Empty icon={meta.icon} title="Nothing in this range" body="Try a longer range, or log something with the + button." />
            </Card>
          )}
        </View>
      </ScrollView>

      {/* the Money tab has its own buttons */}
      {top ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${meta.title.toLowerCase()} entry`}
          onPress={() => setAdding(true)}
          style={({ pressed }) => ({
            position: 'absolute',
            right: space.lg,
            bottom: space.lg + insets.bottom,
            width: 56,
            height: 56,
            borderRadius: radius.pill,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon name="add" size={30} color={t.accentText} />
        </Pressable>
      )}

      <EntryEditor visible={!!editing} entry={editing} onClose={() => setEditing(undefined)} />
      <EntryEditor
        visible={adding}
        defaults={{ category: DEFAULT_CATEGORY[tracker], date: today, awardArea: tracker === 'award' ? 'service' : undefined }}
        onClose={() => setAdding(false)}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 4 }}>
      <Label style={{ marginBottom: 4 }}>{title}</Label>
      {children}
    </Card>
  );
}

