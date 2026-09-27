import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AWARD_AREAS, CATEGORIES, MOOD_LABELS } from '../lib/categories';
import { prettyTime } from '../lib/dates';
import { fmtMinutes, fmtMoney } from '../lib/stats';
import { useTheme } from '../theme';
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
  if (e.amount !== undefined && !e.lifts?.length) parts.push(`${Math.round(e.amount * 10) / 10} ${e.unit ?? ''}`.trim());
  if (e.kind && !e.text.toLowerCase().includes(e.kind)) parts.push(e.kind);
  if (e.minutes) parts.push(fmtMinutes(e.minutes));
  if (e.calories) parts.push(`${e.calories} cal`);
  if (e.protein) parts.push(`${e.protein}g protein`);
  if (e.mood) parts.push(`Mood: ${MOOD_LABELS[e.mood]}`);
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
                <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{AWARD_AREAS[entry.awardArea].short}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {typeof entry.money === 'number' ? (
        <Text style={{ color: entry.money >= 0 ? '#45C27A' : t.danger, fontWeight: '800', fontSize: 15 }}>
          {entry.money >= 0 ? '+' : '−'}
          {fmtMoney(entry.money)}
        </Text>
      ) : null}
    </Pressable>
  );
}
