import React from 'react';
import { ScrollView } from 'react-native';
import { addDays, parseDay, toDay } from '../lib/dates';
import { Chip } from './ui';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function chipLabel(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const d = parseDay(day);
  return `${SHORT_DAYS[d.getDay()]} ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** One-tap picker for the last couple of weeks: Today, Yesterday, Sat Oct 10, ... */
export function DayStrip({ value, onChange, days = 21 }: { value: string; onChange: (day: string) => void; days?: number }) {
  const today = toDay();
  const list = Array.from({ length: days }, (_, i) => addDays(today, -i));
  // a day picked with the arrows that's older than the strip still shows as picked
  if (!list.includes(value)) list.push(value);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
      {list.map((d) => (
        <Chip key={d} label={chipLabel(d, today)} selected={d === value} onPress={() => onChange(d)} />
      ))}
    </ScrollView>
  );
}
