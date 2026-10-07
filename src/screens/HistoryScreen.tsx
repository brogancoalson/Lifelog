import React, { useMemo, useState } from 'react';
import { ScrollView, SectionList, Text, View } from 'react-native';
import { EntryEditor } from '../components/EntryEditor';
import { EntryRow } from '../components/EntryRow';
import { Chip, Empty, Field, IconButton, Title } from '../components/ui';
import { CATEGORIES, CATEGORY_ORDER } from '../lib/categories';
import { prettyDay, toDay } from '../lib/dates';
import { fmtMoney, summarize } from '../lib/stats';
import { useStore } from '../lib/store';
import { IS_FIT } from '../edition';
import { font, space, useInsets, useTheme, upper, ls } from '../theme';
import type { Category, Entry } from '../types';

type Filter = 'all' | 'award' | Category;

export function HistoryScreen({ onBack }: { onBack?: () => void }) {
  const t = useTheme();
  const insets = useInsets();
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Entry | undefined>();
  const today = toDay();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data.entries.filter((e) => {
      if (filter === 'award' && !e.awardArea) return false;
      if (filter !== 'all' && filter !== 'award' && e.category !== filter) return false;
      if (q && !`${e.text} ${e.kind ?? ''} ${(e.lifts ?? []).map((l) => l.name).join(' ')} ${e.details ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const byDay = new Map<string, Entry[]>();
    for (const e of list) {
      const arr = byDay.get(e.date) ?? [];
      arr.push(e);
      byDay.set(e.date, arr);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, entries]) => ({
        day,
        summary: summarize(entries),
        data: entries.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')),
      }));
  }, [data.entries, query, filter]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: onBack ? -10 : 0 }}>
          {onBack ? <IconButton icon="chevron-back" label="Back to Today" onPress={onBack} size={26} /> : null}
          <Title>History</Title>
        </View>
        <Field value={query} onChangeText={setQuery} placeholder="Search everything you've logged" autoCapitalize="none" clearButtonMode="while-editing" />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: 8 }}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {IS_FIT ? null : <Chip label="Award hours" icon="medal" selected={filter === 'award'} onPress={() => setFilter('award')} />}
          {CATEGORY_ORDER.map((c) => (
            <Chip
              key={c}
              label={CATEGORIES[c].label}
              icon={CATEGORIES[c].icon}
              color={CATEGORIES[c].color}
              selected={filter === c}
              onPress={() => setFilter(c)}
            />
          ))}
        </ScrollView>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 60 }}
        renderSectionHeader={({ section }) => {
          const s = section.summary;
          const bits = [
            `${section.data.length} item${section.data.length > 1 ? 's' : ''}`,
            s.waterOz ? `${s.waterOz} oz water` : '',
            s.workouts ? `${s.workouts} workout${s.workouts > 1 ? 's' : ''}` : '',
            s.moneyIn || s.moneyOut ? `net ${s.moneyIn - s.moneyOut < 0 ? '−' : ''}${fmtMoney(s.moneyIn - s.moneyOut)}` : '',
          ].filter(Boolean);
          return (
            <View style={{ paddingTop: space.lg, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ color: t.text, fontFamily: font.labelBold, fontSize: 19, letterSpacing: ls(1), textTransform: upper }}>{prettyDay(section.day, today)}</Text>
              <Text style={{ color: t.textFaint, fontSize: 12, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
                {bits.join(' · ')}
              </Text>
            </View>
          );
        }}
        renderItem={({ item, index }) => (
          <View style={index ? { borderTopWidth: 1, borderTopColor: t.border } : undefined}>
            <EntryRow entry={item} onPress={() => setEditing(item)} />
          </View>
        )}
        ListEmptyComponent={
          <Empty
            icon="time"
            title={data.entries.length ? 'No matches' : 'Nothing here yet'}
            body={data.entries.length ? 'Try a different search or filter.' : 'Everything you log shows up here, newest day first.'}
          />
        }
      />
      <EntryEditor visible={!!editing} entry={editing} onClose={() => setEditing(undefined)} />
    </View>
  );
}
