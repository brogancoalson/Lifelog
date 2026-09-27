import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { EntryEditor } from '../components/EntryEditor';
import { GoalEditor } from '../components/GoalEditor';
import { Body, Button, Card, Empty, Icon, IconButton, Label, ProgressBar, Title } from '../components/ui';
import { AWARD_AREAS, AWARD_ORDER, CATEGORIES } from '../lib/categories';
import { monthsBetween, toDay } from '../lib/dates';
import { shareText } from '../lib/share';
import { awardTotals, fmtHours, fmtMinutes, goalProgress } from '../lib/stats';
import { useStore } from '../lib/store';
import { space, useInsets, useTheme } from '../theme';
import type { AppData, AwardArea, Goal } from '../types';

const PERIOD_LABEL = { day: 'today', week: 'this week', month: 'this month', all: 'overall' } as const;

function awardExport(data: AppData): string {
  const a = data.settings.award;
  const totals = awardTotals(data.entries);
  const lines = [`Congressional Award log (${a.level})`, ''];
  for (const area of AWARD_ORDER) {
    const target = a.targets[area];
    lines.push(`${AWARD_AREAS[area].label}: ${fmtHours(totals[area])}${target ? ` / ${target}` : ''} hrs`);
    const items = data.entries.filter((e) => e.awardArea === area).sort((x, y) => x.date.localeCompare(y.date));
    for (const e of items) {
      lines.push(`  ${e.date}  ${fmtMinutes(e.minutes ?? 0)}  ${e.text}${e.validator ? `  (validator: ${e.validator})` : ''}`);
    }
    lines.push('');
  }
  lines.push(`Expedition trip: ${a.expeditionDone ? 'completed' : 'not yet'}`);
  return lines.join('\n');
}

function AwardCard({ onLogHours }: { onLogHours: (area: AwardArea) => void }) {
  const t = useTheme();
  const { data, updateSettings } = useStore();
  const a = data.settings.award;
  const totals = useMemo(() => awardTotals(data.entries), [data.entries]);
  const [note, setNote] = useState('');
  const months = a.startedOn ? monthsBetween(a.startedOn, toDay()) : undefined;

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="medal" size={22} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Congressional Award</Text>
          <Text style={{ color: t.textDim, fontSize: 13 }}>
            {a.level}
            {months !== undefined ? ` · month ${months} of ${a.minMonths} minimum` : ''}
          </Text>
        </View>
      </View>
      {(['service', 'personal', 'fitness'] as AwardArea[]).map((area) => {
        const target = a.targets[area] || 1;
        const done = totals[area];
        return (
          <Pressable key={area} onPress={() => onLogHours(area)} style={{ gap: 6 }} accessibilityRole="button" accessibilityLabel={`Log ${AWARD_AREAS[area].label} hours`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{AWARD_AREAS[area].label}</Text>
              <Text style={{ color: t.textDim, fontSize: 14, fontVariant: ['tabular-nums'] }}>
                <Text style={{ color: t.text, fontWeight: '800' }}>{fmtHours(done)}</Text> / {a.targets[area]} hrs
              </Text>
            </View>
            <ProgressBar value={done / target} color={t.accent} />
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => updateSettings({ award: { ...a, expeditionDone: !a.expeditionDone } })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: a.expeditionDone }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: a.expeditionDone ? t.accent : t.border,
            backgroundColor: a.expeditionDone ? t.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {a.expeditionDone ? <Icon name="checkmark" size={15} color={t.accentText} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>Expedition trip done</Text>
          <Text style={{ color: t.textDim, fontSize: 12 }}>{fmtHours(totals.expedition)} hrs of planning and prep logged</Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small icon="add" title="Log hours" onPress={() => onLogHours('service')} style={{ flex: 1 }} />
        <Button
          small
          variant="secondary"
          icon="share-outline"
          title={note || 'Export log'}
          onPress={async () => {
            const r = await shareText(awardExport(data), 'Congressional Award log');
            setNote(r === 'copied' ? 'Copied' : r === 'failed' ? "Couldn't export" : '');
            if (r !== 'shared') setTimeout(() => setNote(''), 2000);
          }}
          style={{ flex: 1 }}
        />
      </View>
      <Body dim style={{ fontSize: 12 }}>
        This is your running tracker. Official hours still go in your Record Book or the online portal with a validator’s sign-off.
      </Body>
    </Card>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const t = useTheme();
  const { data, upsertGoal } = useStore();
  const today = toDay();
  const progress = goalProgress(goal, data.entries, today);
  const color = goal.category ? CATEGORIES[goal.category].color : t.accent;
  const done = progress >= goal.target;
  const unit = goal.unit === '$' ? '' : ` ${goal.unit}`;
  const fmt = (n: number) => (goal.unit === '$' ? `$${n.toLocaleString('en-US')}` : n.toLocaleString('en-US'));
  return (
    <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit goal ${goal.title}`}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {done ? <Icon name="checkmark" size={18} color="#45C27A" /> : null}
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={2}>
            {goal.title}
          </Text>
          <Text style={{ color: t.textDim, fontSize: 12 }}>{PERIOD_LABEL[goal.period]}</Text>
        </View>
        <ProgressBar value={progress / goal.target} color={done ? '#45C27A' : color} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: t.textDim, fontSize: 13, fontVariant: ['tabular-nums'] }}>
            <Text style={{ color: t.text, fontWeight: '800' }}>{fmt(progress)}</Text> / {fmt(goal.target)}
            {unit}
          </Text>
          {goal.field === 'manual' ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <IconButton
                icon="remove"
                label="Minus one"
                size={18}
                onPress={() => upsertGoal({ ...goal, manualProgress: Math.max(0, (goal.manualProgress ?? 0) - 1) })}
              />
              <IconButton icon="add" label="Plus one" size={18} onPress={() => upsertGoal({ ...goal, manualProgress: (goal.manualProgress ?? 0) + 1 })} />
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function GoalsScreen() {
  const insets = useInsets();
  const { data } = useStore();
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [addingGoal, setAddingGoal] = useState(false);
  const [logArea, setLogArea] = useState<AwardArea | undefined>();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, gap: space.lg, paddingBottom: 60 }}>
        <Title>Goals</Title>
        <AwardCard onLogHours={setLogArea} />
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label>Your goals</Label>
            <Button small variant="secondary" icon="add" title="Add goal" onPress={() => setAddingGoal(true)} />
          </View>
          {data.goals.length ? (
            data.goals.map((g) => <GoalCard key={g.id} goal={g} onEdit={() => setEditingGoal(g)} />)
          ) : (
            <Card>
              <Empty icon="trophy" title="No goals yet" body="Add one and it fills in from what you log, like water per day or workouts per week." />
            </Card>
          )}
        </View>
      </ScrollView>
      <GoalEditor visible={addingGoal} onClose={() => setAddingGoal(false)} />
      <GoalEditor visible={!!editingGoal} goal={editingGoal} onClose={() => setEditingGoal(undefined)} />
      <EntryEditor
        visible={!!logArea}
        defaults={{ category: logArea === 'fitness' ? 'workout' : 'activity', awardArea: logArea }}
        onClose={() => setLogArea(undefined)}
      />
    </View>
  );
}
