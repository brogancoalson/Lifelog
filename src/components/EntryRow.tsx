import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AWARD_AREAS, CATEGORIES, MOOD_LABELS } from '../lib/categories';
import { prettyTime } from '../lib/dates';
import { fmtAmount, fmtMinutes, fmtMoney } from '../lib/stats';
import { font, useTheme } from '../theme';
import type { Entry } from '../types';
import { CategoryDot, Icon } from './ui';

export function entryDetails(e: Entry): string {
  const parts: string[] = [];
  if (e.lifts?.length) {
    parts.push(
      e.lifts
        .map((l) => {
          const nums = [l.weight, l.reps].filter((n) => n !== undefined).join('×');
          const sets = l.sets ? ` (${l.sets} sets)` : '';
          return nums ? `${l.name} ${nums}${sets}` : l.name;
        })
        .join(', '),
    );
  }
  if (e.amount !== undefined && !e.lifts?.length) parts.push(fmtAmount(e.amount, e.unit));
  if (e.kind && !e.text.toLowerCase().includes(e.kind)) parts.push(e.kind);
  if (e.minutes) parts.push(fmtMinutes(e.minutes));
  const est = e.nutritionEstimated ? '~' : '';
  if (e.protein) parts.push(`${est}${e.protein}g protein`);
  if (e.carbs) parts.push(`${est}${e.carbs}g carbs`);
  if (e.calories) parts.push(`${est}${e.calories} cal`);
  if (e.mood) parts.push(e.category === 'sleep' ? `Slept ${MOOD_LABELS[e.mood].toLowerCase()}` : `Mood: ${MOOD_LABELS[e.mood]}`);
  return parts.join(' · ');
}

export function EntryRow({ entry, onPress, showDate }: { entry: Entry; onPress?: () => void; showDate?: string }) {
  const t = useTheme();
  const meta = CATEGORIES[entry.category];
  const details = entryDetails(entry);
  const time = showDate ?? prettyTime(entry.time);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${entry.text}. Tap to edit.`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <CategoryDot color={meta.color} icon={meta.icon} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
          {entry.text}
        </Text>
        {details || time || entry.awardArea ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {time ? <Text style={{ color: t.textFaint, fontSize: 13 }}>{time}</Text> : null}
            {details ? (
              <Text style={{ color: t.textDim, fontSize: 13, flexShrink: 1 }} numberOfLines={2}>
                {details}
              </Text>
            ) : null}
            {entry.awardArea ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon name="medal" size={12} color={t.accent} />
                <Text style={{ color: t.accent, fontSize: 13, fontFamily: font.labelBold, letterSpacing: 0.8, textTransform: 'uppercase' }}>{AWARD_AREAS[entry.awardArea].short}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {typeof entry.money === 'number' ? (
        <Text style={{ color: entry.money >= 0 ? t.good : t.danger, fontFamily: font.display, fontSize: 24, letterSpacing: 0.5 }}>
          {entry.money >= 0 ? '+' : '−'}
          {fmtMoney(entry.money)}
        </Text>
      ) : null}
    </Pressable>
  );
}
