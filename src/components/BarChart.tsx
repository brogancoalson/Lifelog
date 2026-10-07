import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Bucket } from '../lib/trackers';
import { font, useTheme, upper, ls, radius } from '../theme';

/**
 * Single-series column chart built from Views (no chart library needed).
 * Square bars (the app's hard look), max 24px wide with a 2px gap, one baseline.
 * Tap a column to read its exact value; negative values drop below the baseline.
 */
export function BarChart({
  data,
  color,
  negativeColor,
  format,
  height = 150,
}: {
  data: Bucket[];
  color: string;
  negativeColor?: string;
  format: (v: number) => string;
  height?: number;
}) {
  const t = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const values = data.map((d) => d.value ?? 0);
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.max(0, ...values.map((v) => -v));
  const span = maxPos + maxNeg || 1;
  const posH = (maxPos / span) * height;
  const negH = (maxNeg / span) * height;
  const sel = selected !== null ? data[selected] : null;
  const logged = data.filter((d) => d.value !== null).length;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', minHeight: 22 }}>
        {sel ? (
          <Text style={{ color: t.text, fontFamily: font.labelBold, fontSize: 16, letterSpacing: ls(0.8), textTransform: upper }}>
            {sel.long}: {sel.value === null ? 'nothing logged' : format(sel.value)}
          </Text>
        ) : (
          <Text style={{ color: t.textFaint, fontFamily: font.label, fontSize: 14, letterSpacing: ls(0.8), textTransform: upper }}>
            {logged ? 'Tap a bar for its number' : 'Nothing logged in this range'}
          </Text>
        )}
        <Text style={{ color: t.textFaint, fontSize: 12 }}>max {format(maxPos || 0)}</Text>
      </View>

      <View>
        {/* top reference line (max) */}
        <View style={{ height: 1, backgroundColor: t.border, opacity: 0.6 }} />
        <View style={{ flexDirection: 'row', alignItems: 'stretch', height, gap: 2 }}>
          {data.map((d, i) => {
            const v = d.value ?? 0;
            const h = v > 0 ? Math.max(2, (v / span) * height) : v < 0 ? Math.max(2, (-v / span) * height) : 0;
            const active = selected === i;
            const dim = selected !== null && !active;
            return (
              <Pressable
                key={d.key}
                onPress={() => setSelected(active ? null : i)}
                accessibilityRole="button"
                accessibilityLabel={`${d.long}: ${d.value === null ? 'nothing logged' : format(d.value)}`}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <View style={{ height: posH, width: '100%', maxWidth: 24, justifyContent: 'flex-end' }}>
                  {v > 0 ? <View style={{ height: h, backgroundColor: color, opacity: dim ? 0.35 : 1, borderTopLeftRadius: Math.min(radius.sm, 6), borderTopRightRadius: Math.min(radius.sm, 6) }} /> : null}
                </View>
                <View style={{ height: negH, width: '100%', maxWidth: 24 }}>
                  {v < 0 ? <View style={{ height: h, backgroundColor: negativeColor ?? color, opacity: dim ? 0.35 : 1, borderBottomLeftRadius: Math.min(radius.sm, 6), borderBottomRightRadius: Math.min(radius.sm, 6) }} /> : null}
                </View>
                {active ? (
                  <View style={{ position: 'absolute', top: 0, bottom: 0, width: '100%', maxWidth: 24, borderWidth: 1, borderColor: t.text, borderRadius: Math.min(radius.sm, 6), opacity: 0.5 }} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {/* baseline sits between positive and negative space */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 1 + posH, height: 1, backgroundColor: t.borderStrong }} />
      </View>

      {data.length <= 7 ? (
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {data.map((d) => (
            <Text key={d.key} numberOfLines={1} style={{ flex: 1, color: t.textFaint, fontSize: 12, fontFamily: font.label, textAlign: 'center' }}>
              {d.label}
            </Text>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i, n) => (
            <Text key={n} style={{ color: t.textFaint, fontSize: 12, fontFamily: font.label, letterSpacing: ls(0.5), textTransform: upper }}>
              {data[i].long.replace('Week of ', '')}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
