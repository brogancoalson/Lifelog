import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AWARD_AREAS, CATEGORIES, MOOD_LABELS } from '../lib/categories';
import { prettyTime } from '../lib/dates';
import { fmtAmount, fmtMinutes, fmtMoney } from '../lib/stats';
import { font, useTheme } from '../theme';
import type { Entry } from '../types';
import { CategoryDot, Icon } from './ui';

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 3 }}>
      <Text style={{ width: 86, color: t.textFaint, fontSize: 13, fontFamily: font.label, letterSpacing: 0.8, textTransform: 'uppercase' }}>{k}</Text>
      <Text style={{ flex: 1, color: color ?? t.text, fontSize: 14, lineHeight: 19 }}>{v}</Text>
    </View>
  );
}

/** Every field of one entry, laid out in full. Tap to edit. */
export function EntryDetail({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const t = useTheme();
  const meta = CATEGORIES[entry.category];
  const logged = new Date(entry.createdAt);
  const loggedAt = Number.isNaN(logged.getTime())
    ? ''
    : logged.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const rows: { k: string; v: string; color?: string }[] = [];
  if (entry.amount !== undefined) rows.push({ k: 'Amount', v: fmtAmount(entry.amount, entry.unit) });
  if (entry.kind) rows.push({ k: 'Type', v: entry.kind });
  if (entry.minutes) rows.push({ k: 'Duration', v: fmtMinutes(entry.minutes) });
  const est = entry.nutritionEstimated ? ' (estimated)' : '';
  if (entry.protein) rows.push({ k: 'Protein', v: `${entry.protein} g${est}` });
  if (entry.carbs) rows.push({ k: 'Carbs', v: `${entry.carbs} g${est}` });
  if (entry.calories) rows.push({ k: 'Calories', v: `${entry.calories}${est}` });
  if (typeof entry.money === 'number')
    rows.push({ k: entry.money >= 0 ? 'Made' : 'Spent', v: `${entry.money >= 0 ? '+' : '−'}${fmtMoney(entry.money)}`, color: entry.money >= 0 ? t.good : t.danger });
  if (entry.mood) rows.push({ k: 'Mood', v: `${entry.mood} of 5 · ${MOOD_LABELS[entry.mood]}` });
  for (const l of entry.lifts ?? []) {
    const parts = [
      l.weight !== undefined ? `${l.weight} lbs` : '',
      l.reps !== undefined ? `${l.reps} reps` : '',
      l.sets !== undefined ? `${l.sets} sets` : '',
    ].filter(Boolean);
    const e1 = l.weight && l.reps && l.reps > 1 ? Math.round(l.weight * (1 + l.reps / 30)) : undefined;
    rows.push({ k: 'Lift', v: `${l.name}${parts.length ? ` — ${parts.join(' × ')}` : ''}${e1 ? ` · est. max ${e1}` : ''}` });
  }
  if (entry.awardArea) rows.push({ k: 'Award', v: AWARD_AREAS[entry.awardArea].label, color: t.accent });
  if (entry.awardArea) rows.push({ k: 'Validator', v: entry.validator ?? 'not added yet', color: entry.validator ? undefined : t.textFaint });
  rows.push({ k: 'Logged', v: `${loggedAt}${loggedAt ? ' · ' : ''}${entry.source === 'chat' ? 'from chat' : entry.source === 'health' ? 'from Health' : 'by hand'}`, color: t.textFaint });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${entry.text}. Tap to edit.`}
      style={({ pressed }) => ({
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.border,
        padding: 12,
        gap: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <CategoryDot color={meta.color} icon={meta.icon} size={30} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{entry.text}</Text>
          <Text style={{ color: t.textDim, fontSize: 12, fontFamily: font.label, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {[prettyTime(entry.time), meta.label].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Icon name="create-outline" size={16} color={t.textFaint} />
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: t.border, paddingTop: 6 }}>
        {rows.map((r, i) => (
          <Row key={i} k={r.k} v={r.v} color={r.color} />
        ))}
      </View>
    </Pressable>
  );
}
