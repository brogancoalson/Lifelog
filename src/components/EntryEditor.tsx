import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AWARD_AREAS, AWARD_ORDER, CATEGORIES, CATEGORY_ORDER, MOOD_LABELS } from '../lib/categories';
import { addDays, prettyDay, toDay, toTime, uid } from '../lib/dates';
import { matchBucket } from '../lib/money';
import { estimateNutrition } from '../lib/nutrition';
import { normalizeEntry } from '../lib/storage';
import { useStore } from '../lib/store';
import { font, radius, space, useInsets, useTheme } from '../theme';
import type { AwardArea, Category, Entry } from '../types';
import { Body, Button, Chip, Field, IconButton, Label } from './ui';

interface LiftForm {
  key: string;
  name: string;
  weight: string;
  reps: string;
  sets: string;
}

interface Form {
  category: Category;
  text: string;
  date: string;
  minutes: string;
  amount: string;
  unit: string;
  kind: string;
  calories: string;
  protein: string;
  carbs: string;
  money: string;
  moneyDir: 'in' | 'out';
  mood: number;
  lifts: LiftForm[];
  bucketId?: string;
  bucketTouched: boolean;
  sleepHours: string;
  awardArea?: AwardArea;
  validator: string;
}

const s = (n?: number) => (n === undefined ? '' : String(n));
const n = (v: string) => {
  const x = parseFloat(v.replace(/[$,]/g, ''));
  return Number.isFinite(x) ? x : undefined;
};

function toForm(e?: Entry, defaults?: Partial<Entry>): Form {
  return {
    category: e?.category ?? defaults?.category ?? 'food',
    text: e?.text ?? '',
    date: e?.date ?? defaults?.date ?? toDay(),
    minutes: s(e?.minutes),
    amount: s(e?.amount),
    unit: e?.unit ?? 'oz',
    kind: e?.kind ?? '',
    calories: s(e?.calories),
    protein: s(e?.protein),
    carbs: s(e?.carbs),
    money: e?.money !== undefined ? s(Math.abs(e.money)) : '',
    moneyDir: e?.money !== undefined && e.money >= 0 ? 'in' : 'out',
    mood: e?.mood ?? 0,
    lifts: (e?.lifts ?? []).map((l) => ({ key: uid(), name: l.name, weight: s(l.weight), reps: s(l.reps), sets: s(l.sets) })),
    bucketId: e?.bucketId,
    bucketTouched: !!e,
    sleepHours: e?.category === 'sleep' && e.minutes ? s(Math.round((e.minutes / 60) * 100) / 100) : '',
    awardArea: e?.awardArea ?? defaults?.awardArea,
    validator: e?.validator ?? '',
  };
}

export function EntryEditor({
  visible,
  entry,
  defaults,
  onClose,
}: {
  visible: boolean;
  entry?: Entry;
  defaults?: Partial<Entry>;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useInsets();
  const { data, addEntries, updateEntry, deleteEntries } = useStore();
  const [f, setF] = useState<Form>(() => toForm(entry, defaults));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form each time the sheet opens (not on every parent render).
  const openToken = visible ? entry?.id ?? 'new' : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (openToken !== openedFor) {
    setOpenedFor(openToken);
    if (openToken) {
      setF(toForm(entry, defaults));
      setConfirmDelete(false);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const cat = f.category;
  const needsMinutes = !!f.awardArea;
  const moneyVal = n(f.money);
  const canSave = f.text.trim().length > 0 && (!needsMinutes || !!n(f.minutes));

  const save = () => {
    const today = toDay();
    const raw: any = {
      id: entry?.id,
      createdAt: entry?.createdAt,
      source: entry?.source ?? 'manual',
      date: f.date,
      time: entry?.time ?? (f.date === today ? toTime() : undefined),
      category: cat,
      text: f.text,
      minutes: n(f.minutes),
      awardArea: f.awardArea,
      validator: f.awardArea ? f.validator : undefined,
    };
    if (cat === 'drink' || cat === 'workout') {
      raw.amount = n(f.amount);
      raw.unit = raw.amount !== undefined ? f.unit || undefined : undefined;
    }
    if (cat === 'drink' || cat === 'activity' || cat === 'business' || cat === 'money') raw.kind = f.kind;
    if (cat === 'food' || cat === 'drink') {
      const typed = { calories: n(f.calories), protein: n(f.protein), carbs: n(f.carbs) };
      const anyTyped = typed.calories !== undefined || typed.protein !== undefined || typed.carbs !== undefined;
      const unchanged =
        !!entry && typed.calories === entry.calories && typed.protein === entry.protein && typed.carbs === entry.carbs;
      const textChanged = !!entry && f.text.trim() !== entry.text;
      if (!anyTyped || (entry?.nutritionEstimated && unchanged && textChanged)) {
        // nothing typed (or an old estimate for a changed description): estimate from what it is
        const est = estimateNutrition(f.text);
        if (est) Object.assign(raw, est, { nutritionEstimated: true });
      } else {
        Object.assign(raw, typed, { nutritionEstimated: entry?.nutritionEstimated && unchanged ? true : undefined });
      }
    }
    if (cat === 'money' && moneyVal !== undefined) raw.money = f.moneyDir === 'in' ? moneyVal : -moneyVal;
    if (cat === 'money' && f.moneyDir === 'out') raw.bucketId = f.bucketTouched ? f.bucketId : matchBucket(f.text, f.kind, data.buckets);
    if (cat === 'money' && f.moneyDir === 'in' && entry?.allocations) raw.allocations = entry.allocations;
    if (cat === 'money' && entry?.incomeKind) raw.incomeKind = entry.incomeKind;
    if (cat === 'sleep') {
      const h = n(f.sleepHours);
      raw.minutes = h !== undefined ? Math.round(h * 60) : undefined;
      if (f.mood) raw.mood = f.mood;
    }
    if (cat === 'mood' && f.mood) raw.mood = f.mood;
    if (cat === 'workout')
      raw.lifts = f.lifts.filter((l) => l.name.trim()).map((l) => ({ name: l.name, weight: n(l.weight), reps: n(l.reps), sets: n(l.sets) }));
    const e = normalizeEntry(raw, { source: 'manual' });
    if (!e) return;
    if (entry) updateEntry(e);
    else addEntries([e]);
    onClose();
  };

  const updateLift = (key: string, patch: Partial<LiftForm>) =>
    set('lifts', f.lifts.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const placeholder: Record<Category, string> = {
    food: 'Chicken and rice',
    drink: 'Water',
    workout: 'Push day',
    activity: 'Volunteered at the food bank',
    business: 'Shipped 3 Unconquered orders',
    social: 'Dinner date',
    mood: 'Locked in today',
    money: 'Sold 2 hoodies',
    sleep: 'Slept',
    note: 'Anything else',
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? t.overlay : t.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            backgroundColor: t.bg,
            marginTop: Platform.OS === 'web' ? 40 : 0,
            borderTopLeftRadius: Platform.OS === 'web' ? radius.lg : 0,
            borderTopRightRadius: Platform.OS === 'web' ? radius.lg : 0,
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: space.sm,
              paddingTop: space.sm,
              borderBottomWidth: 1,
              borderBottomColor: t.border,
              paddingBottom: space.sm,
            }}
          >
            <IconButton icon="close" label="Close" onPress={onClose} />
            <Text style={{ color: t.text, fontSize: 26, fontFamily: font.display, letterSpacing: 1.2 }}>{entry ? 'Edit entry' : 'Log something'}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 8 }}>
              <Label>Type</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORY_ORDER.map((c) => (
                  <Chip
                    key={c}
                    label={CATEGORIES[c].label}
                    icon={CATEGORIES[c].icon}
                    color={CATEGORIES[c].color}
                    selected={cat === c}
                    onPress={() => set('category', c)}
                  />
                ))}
              </View>
            </View>

            <Field label="What" value={f.text} onChangeText={(v) => set('text', v)} placeholder={placeholder[cat]} autoFocus={!entry} />

            <View style={{ gap: 8 }}>
              <Label>Day</Label>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <IconButton icon="chevron-back" label="Previous day" onPress={() => set('date', addDays(f.date, -1))} />
                <Body style={{ fontWeight: '700', minWidth: 130, textAlign: 'center' }}>{prettyDay(f.date)}</Body>
                <IconButton icon="chevron-forward" label="Next day" onPress={() => set('date', addDays(f.date, 1))} />
              </View>
            </View>

            {cat === 'drink' ? (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="How much" value={f.amount} onChangeText={(v) => set('amount', v)} keyboardType="decimal-pad" placeholder="32" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Drink" value={f.kind} onChangeText={(v) => set('kind', v)} placeholder="water" autoCapitalize="none" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {['oz', 'cups', 'bottles', 'drinks'].map((u) => (
                    <Chip key={u} label={u} selected={f.unit === u} onPress={() => set('unit', u)} />
                  ))}
                </View>
              </View>
            ) : null}

            {cat === 'food' || cat === 'drink' ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Calories" value={f.calories} onChangeText={(v) => set('calories', v)} keyboardType="number-pad" placeholder="auto" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Protein g" value={f.protein} onChangeText={(v) => set('protein', v)} keyboardType="number-pad" placeholder="auto" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Carbs g" value={f.carbs} onChangeText={(v) => set('carbs', v)} keyboardType="number-pad" placeholder="auto" />
                  </View>
                </View>
                <Body dim style={{ fontSize: 13 }}>
                  {entry?.nutritionEstimated
                    ? 'These are estimates from the description. Type your own numbers to replace them.'
                    : 'Leave blank and they’re estimated from what you ate, like “half pound burger and fries.”'}
                </Body>
              </View>
            ) : null}

            {cat === 'workout' ? (
              <View style={{ gap: 10 }}>
                <Label>Lifts</Label>
                {f.lifts.map((l) => (
                  <View key={l.key} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
                    <View style={{ flex: 2.2 }}>
                      <Field value={l.name} onChangeText={(v) => updateLift(l.key, { name: v })} placeholder="Bench" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field value={l.weight} onChangeText={(v) => updateLift(l.key, { weight: v })} placeholder="lbs" keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field value={l.reps} onChangeText={(v) => updateLift(l.key, { reps: v })} placeholder="reps" keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field value={l.sets} onChangeText={(v) => updateLift(l.key, { sets: v })} placeholder="sets" keyboardType="number-pad" />
                    </View>
                    <IconButton icon="trash-outline" label="Remove lift" size={18} onPress={() => set('lifts', f.lifts.filter((x) => x.key !== l.key))} />
                  </View>
                ))}
                <Button
                  small
                  variant="secondary"
                  icon="add"
                  title="Add lift"
                  onPress={() => set('lifts', [...f.lifts, { key: uid(), name: '', weight: '', reps: '', sets: '' }])}
                  style={{ alignSelf: 'flex-start' }}
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Distance (optional)" value={f.amount} onChangeText={(v) => set('amount', v)} keyboardType="decimal-pad" placeholder="miles" />
                  </View>
                  <View style={{ flex: 1 }} />
                </View>
              </View>
            ) : null}

            {cat === 'money' ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Chip label="Made" color={t.good} selected={f.moneyDir === 'in'} onPress={() => set('moneyDir', 'in')} />
                  <Chip label="Spent" color={t.danger} selected={f.moneyDir === 'out'} onPress={() => set('moneyDir', 'out')} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Amount ($)" value={f.money} onChangeText={(v) => set('money', v)} keyboardType="decimal-pad" placeholder="0.00" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="For (optional)" value={f.kind} onChangeText={(v) => set('kind', v)} placeholder={f.moneyDir === 'out' ? 'gas' : 'business'} autoCapitalize="none" />
                  </View>
                </View>
                {f.moneyDir === 'out' && data.buckets.length ? (
                  <View style={{ gap: 8 }}>
                    <Label>Came out of</Label>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {(() => {
                        const picked = f.bucketTouched ? f.bucketId : matchBucket(f.text, f.kind, data.buckets);
                        return (
                          <>
                            <Chip label="Free money" selected={!picked} onPress={() => setF((p) => ({ ...p, bucketId: undefined, bucketTouched: true }))} />
                            {data.buckets.map((b) => (
                              <Chip key={b.id} label={b.name} selected={picked === b.id} onPress={() => setF((p) => ({ ...p, bucketId: b.id, bucketTouched: true }))} />
                            ))}
                          </>
                        );
                      })()}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {cat === 'sleep' ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Hours slept" value={f.sleepHours} onChangeText={(v) => set('sleepHours', v)} keyboardType="decimal-pad" placeholder="7.5" />
                  </View>
                  <View style={{ flex: 1 }} />
                </View>
                <Label>How you slept</Label>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map((m) => (
                    <Chip key={m} label={`${m} · ${MOOD_LABELS[m]}`} color={CATEGORIES.sleep.color} selected={f.mood === m} onPress={() => set('mood', f.mood === m ? 0 : m)} />
                  ))}
                </View>
              </View>
            ) : null}

            {cat === 'mood' ? (
              <View style={{ gap: 8 }}>
                <Label>How you feel</Label>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map((m) => (
                    <Chip key={m} label={`${m} · ${MOOD_LABELS[m]}`} color={CATEGORIES.mood.color} selected={f.mood === m} onPress={() => set('mood', m)} />
                  ))}
                </View>
              </View>
            ) : null}

            {cat !== 'mood' && cat !== 'money' && cat !== 'food' && cat !== 'drink' && cat !== 'sleep' ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Minutes" value={f.minutes} onChangeText={(v) => set('minutes', v)} keyboardType="number-pad" placeholder="60" />
                </View>
                <View style={{ flex: 1 }} />
              </View>
            ) : null}

            <View style={{ gap: 8, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: t.border }}>
              <Label>Counts toward Congressional Award</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="No" selected={!f.awardArea} onPress={() => set('awardArea', undefined)} />
                {AWARD_ORDER.map((a) => (
                  <Chip key={a} label={AWARD_AREAS[a].short} icon="medal" selected={f.awardArea === a} onPress={() => set('awardArea', a)} />
                ))}
              </View>
              {f.awardArea ? (
                <View style={{ gap: 10 }}>
                  {cat === 'mood' || cat === 'money' || cat === 'food' || cat === 'drink' ? (
                    <Field label="Minutes" value={f.minutes} onChangeText={(v) => set('minutes', v)} keyboardType="number-pad" placeholder="60" />
                  ) : null}
                  {!n(f.minutes) ? <Body dim style={{ fontSize: 13 }}>Add minutes so the hours count.</Body> : null}
                  <Field label="Validator (optional)" value={f.validator} onChangeText={(v) => set('validator', v)} placeholder="Who can sign off on this" />
                </View>
              ) : null}
            </View>

            <Button title={entry ? 'Save changes' : 'Save'} onPress={save} disabled={!canSave} />
            {entry ? (
              confirmDelete ? (
                <View style={{ gap: 8 }}>
                  <Body dim style={{ textAlign: 'center' }}>Delete this entry for good?</Body>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
                    <Button
                      title="Delete"
                      variant="danger"
                      onPress={() => {
                        deleteEntries([entry.id]);
                        onClose();
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setConfirmDelete(true)} style={{ alignSelf: 'center', padding: 8 }}>
                  <Text style={{ color: t.danger, fontWeight: '600' }}>Delete entry</Text>
                </Pressable>
              )
            ) : null}
            <View style={{ height: insets.bottom }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
