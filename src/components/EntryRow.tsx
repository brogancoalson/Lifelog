import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AWARD_AREAS, CATEGORIES, MOOD_LABELS } from '../lib/categories';
import { prettyTime } from '../lib/dates';
import { fmtAmount, fmtMinutes, fmtMoney } from '../lib/stats';
import { detailLines, liftSummary } from '../lib/workout';
import { font, useTheme, upper, ls, ds } from '../theme';
import type { Entry } from '../types';
import { CategoryDot, Icon } from './ui';

export function entryDetails(e: Entry): string {
  const parts: string[] = [];
  // a written-out workout shows its bullet lines instead (WorkoutBullets)
  if (e.lifts?.length && !e.details) parts.push(e.lifts.map(liftSummary).join(', '));
  if (e.amount !== undefined && (!e.lifts?.length || e.details)) parts.push(fmtAmount(e.amount, e.unit));
  if (e.kind && !e.text.toLowerCase().includes(e.kind)) parts.push(e.kind);
  if (e.minutes) parts.push(fmtMinutes(e.minutes));
  const est = e.nutritionEstimated ? '~' : '';
  if (e.protein) parts.push(`${est}${e.protein}g protein`);
  if (e.carbs) parts.push(`${est}${e.carbs}g carbs`);
  if (e.calories) parts.push(`${est}${e.calories} cal`);
  if (e.mood) parts.push(e.category === 'sleep' ? `Slept ${MOOD_LABELS[e.mood].toLowerCase()}` : `Mood: ${MOOD_LABELS[e.mood]}`);
  return parts.join(' · ');
}

/** A workout's lines as bullets (one line shows as plain text), cut off after `max` with "+N more". */
export function WorkoutBullets({ details, max = 4, size = 13, clamp = 2 }: { details?: string; max?: number; size?: number; clamp?: number }) {
  const t = useTheme();
  const lines = detailLines(details);
  if (!lines.length) return null;
  const shown = lines.length > max + 1 ? lines.slice(0, max) : lines;
  const style = { flex: 1, color: t.textDim, fontSize: size, lineHeight: size + 5 };
  if (lines.length === 1) {
    return (
      <Text style={style} numberOfLines={clamp ? clamp + 1 : undefined}>
        {lines[0]}
      </Text>
    );
  }
  return (
    <View style={{ gap: 2 }}>
      {shown.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
          <Text style={{ color: t.textFaint, fontSize: size, lineHeight: size + 5 }}>•</Text>
          <Text style={style} numberOfLines={clamp || undefined}>
            {l}
          </Text>
        </View>
      ))}
      {shown.length < lines.length ? <Text style={{ color: t.textFaint, fontSize: size - 1, marginLeft: 12 }}>+{lines.length - shown.length} more</Text> : null}
    </View>
  );
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
        <WorkoutBullets details={entry.details} />
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
                <Text style={{ color: t.accent, fontSize: 13, fontFamily: font.labelBold, letterSpacing: ls(0.8), textTransform: upper }}>{AWARD_AREAS[entry.awardArea].short}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {typeof entry.money === 'number' ? (
        <Text style={{ color: entry.money >= 0 ? t.good : t.danger, fontFamily: font.display, fontSize: ds(24), letterSpacing: ls(0.5) }}>
          {entry.money >= 0 ? '+' : '−'}
          {fmtMoney(entry.money)}
        </Text>
      ) : null}
    </Pressable>
  );
}
