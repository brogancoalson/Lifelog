import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { CATEGORIES, CATEGORY_ORDER } from '../lib/categories';
import { uid } from '../lib/dates';
import { useStore } from '../lib/store';
import { font, radius, space, useTheme } from '../theme';
import type { Category, Goal, GoalField, GoalPeriod } from '../types';
import { Body, Button, Chip, Field, IconButton, Label } from './ui';

type Template = Omit<Goal, 'id' | 'createdAt'>;

const TEMPLATES: Template[] = [
  { title: 'Drink 100 oz of water', target: 100, unit: 'oz', period: 'day', field: 'amount', category: 'drink', kind: 'water' },
  { title: 'Work out 5 times', target: 5, unit: 'workouts', period: 'week', field: 'count', category: 'workout' },
  { title: 'Hit 180g protein', target: 180, unit: 'g', period: 'day', field: 'protein', category: 'food' },
  { title: 'Make $1,000', target: 1000, unit: '$', period: 'month', field: 'moneyIn', category: 'money' },
  { title: '10 business moves', target: 10, unit: 'moves', period: 'week', field: 'count', category: 'business' },
  { title: 'Read 12 books', target: 12, unit: 'books', period: 'all', field: 'manual' },
];

const PERIODS: { key: GoalPeriod; label: string }[] = [
  { key: 'day', label: 'Each day' },
  { key: 'week', label: 'Each week' },
  { key: 'month', label: 'Each month' },
  { key: 'all', label: 'Overall' },
];

const FIELDS_FOR: Record<Category, { key: GoalField; label: string }[]> = {
  food: [
    { key: 'count', label: 'Meals' },
    { key: 'protein', label: 'Protein (g)' },
    { key: 'calories', label: 'Calories' },
  ],
  drink: [
    { key: 'amount', label: 'Amount' },
    { key: 'count', label: 'Drinks' },
  ],
  workout: [
    { key: 'count', label: 'Workouts' },
    { key: 'minutes', label: 'Minutes' },
    { key: 'amount', label: 'Distance' },
  ],
  activity: [
    { key: 'count', label: 'Times' },
    { key: 'minutes', label: 'Minutes' },
  ],
  business: [
    { key: 'count', label: 'Times' },
    { key: 'minutes', label: 'Minutes' },
  ],
  social: [
    { key: 'count', label: 'Times' },
    { key: 'minutes', label: 'Minutes' },
  ],
  mood: [{ key: 'count', label: 'Check-ins' }],
  money: [
    { key: 'moneyIn', label: 'Money made' },
    { key: 'moneyOut', label: 'Money spent' },
  ],
  note: [{ key: 'count', label: 'Times' }],
};

interface Form {
  title: string;
  target: string;
  unit: string;
  period: GoalPeriod;
  field: GoalField;
  category?: Category;
  kind: string;
}

const toForm = (g?: Goal | Template): Form => ({
  title: g?.title ?? '',
  target: g ? String(g.target) : '',
  unit: g?.unit ?? '',
  period: g?.period ?? 'week',
  field: g?.field ?? 'manual',
  category: g?.category,
  kind: g?.kind ?? '',
});

export function GoalEditor({ visible, goal, onClose }: { visible: boolean; goal?: Goal; onClose: () => void }) {
  const t = useTheme();
  const { upsertGoal, deleteGoal } = useStore();
  const [f, setF] = useState<Form>(() => toForm(goal));

  const openToken = visible ? goal?.id ?? 'new' : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (openToken !== openedFor) {
    setOpenedFor(openToken);
    if (openToken) setF(toForm(goal));
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const target = parseFloat(f.target.replace(/[$,]/g, ''));
  const canSave = f.title.trim() && Number.isFinite(target) && target > 0;

  const save = () => {
    if (!canSave) return;
    upsertGoal({
      id: goal?.id ?? uid(),
      createdAt: goal?.createdAt ?? new Date().toISOString(),
      title: f.title.trim(),
      target,
      unit: f.unit.trim(),
      period: f.period,
      field: f.category ? f.field : 'manual',
      category: f.category,
      kind: f.category ? f.kind.trim().toLowerCase() || undefined : undefined,
      manualProgress: goal?.manualProgress,
    });
    onClose();
  };

  const pickCategory = (c?: Category) => {
    setF((p) => ({ ...p, category: c, field: c ? FIELDS_FOR[c][0].key : 'manual' }));
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
              padding: space.sm,
              borderBottomWidth: 1,
              borderBottomColor: t.border,
            }}
          >
            <IconButton icon="close" label="Close" onPress={onClose} />
            <Text style={{ color: t.text, fontSize: 26, fontFamily: font.display, letterSpacing: 1.2 }}>{goal ? 'Edit goal' : 'New goal'}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            {!goal ? (
              <View style={{ gap: 8 }}>
                <Label>Start from</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {TEMPLATES.map((tpl) => (
                    <Chip key={tpl.title} label={tpl.title} onPress={() => setF(toForm(tpl))} selected={f.title === tpl.title} />
                  ))}
                </View>
              </View>
            ) : null}
            <Field label="Goal" value={f.title} onChangeText={(v) => set('title', v)} placeholder="Drink 100 oz of water" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Target" value={f.target} onChangeText={(v) => set('target', v)} keyboardType="decimal-pad" placeholder="100" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Unit" value={f.unit} onChangeText={(v) => set('unit', v)} placeholder="oz" autoCapitalize="none" />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Label>How often</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PERIODS.map((p) => (
                  <Chip key={p.key} label={p.label} selected={f.period === p.key} onPress={() => set('period', p.key)} />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Label>Track it from</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="I'll update it myself" selected={!f.category} onPress={() => pickCategory(undefined)} />
                {CATEGORY_ORDER.filter((c) => c !== 'note').map((c) => (
                  <Chip
                    key={c}
                    label={CATEGORIES[c].label}
                    icon={CATEGORIES[c].icon}
                    color={CATEGORIES[c].color}
                    selected={f.category === c}
                    onPress={() => pickCategory(c)}
                  />
                ))}
              </View>
              {f.category ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Label>Count</Label>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {FIELDS_FOR[f.category].map((fld) => (
                      <Chip key={fld.key} label={fld.label} selected={f.field === fld.key} onPress={() => set('field', fld.key)} />
                    ))}
                  </View>
                  <Field
                    label="Only entries mentioning (optional)"
                    value={f.kind}
                    onChangeText={(v) => set('kind', v)}
                    placeholder={f.category === 'drink' ? 'water' : 'e.g. golf'}
                    autoCapitalize="none"
                  />
                  <Body dim style={{ fontSize: 13 }}>
                    Progress fills in automatically from what you log.
                  </Body>
                </View>
              ) : (
                <Body dim style={{ fontSize: 13 }}>
                  You’ll tap + and − on the goal to update it.
                </Body>
              )}
            </View>
            <Button title={goal ? 'Save changes' : 'Add goal'} onPress={save} disabled={!canSave} />
            {goal ? (
              <Pressable
                onPress={() => {
                  deleteGoal(goal.id);
                  onClose();
                }}
                style={{ alignSelf: 'center', padding: 8 }}
              >
                <Text style={{ color: t.danger, fontWeight: '600' }}>Delete goal</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
