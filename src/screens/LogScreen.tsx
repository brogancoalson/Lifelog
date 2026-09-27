import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { EntryEditor } from '../components/EntryEditor';
import { entryDetails } from '../components/EntryRow';
import { Body, CategoryDot, Icon, IconButton, Title } from '../components/ui';
import { detectSortMode, sortMessage, SortMode } from '../lib/aiParse';
import { AWARD_AREAS, CATEGORIES } from '../lib/categories';
import { prettyDay } from '../lib/dates';
import { useStore } from '../lib/store';
import { radius, space, useInsets, useTheme } from '../theme';
import type { ChatMessage, Entry } from '../types';

const EXAMPLES = [
  'Chicken and rice for lunch, 2 bottles of water',
  'Benched 225 for 5 and squatted 315x3, 1 hr at the gym',
  'Volunteered at the food bank 2 hrs',
  'Sold 2 hoodies $90, spent $14 on gas',
  'Felt locked in today',
];

const MODE_LABEL: Record<SortMode, string> = {
  'ai-server': 'AI sorting on',
  'ai-preview': 'AI sorting on (preview)',
  quick: 'Quick sort (offline)',
};

function MessageEntries({ entries, onEdit }: { entries: Entry[]; onEdit: (e: Entry) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, marginTop: 8 }}>
      {entries.map((e) => {
        const meta = CATEGORIES[e.category];
        const details = entryDetails(e);
        return (
          <Pressable
            key={e.id}
            onPress={() => onEdit(e)}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label}: ${e.text}. Tap to fix.`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <CategoryDot color={meta.color} icon={meta.icon} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }} numberOfLines={2}>
                {e.text}
              </Text>
              <Text style={{ color: t.textDim, fontSize: 12 }} numberOfLines={2}>
                {[meta.label, details, e.awardArea ? `Award: ${AWARD_AREAS[e.awardArea].short}` : '', e.money !== undefined ? `${e.money >= 0 ? '+' : '−'}$${Math.abs(e.money)}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Icon name="create-outline" size={16} color={t.textFaint} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function LogScreen() {
  const t = useTheme();
  const insets = useInsets();
  const { data, addEntries, deleteEntries, addChat, updateChat } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<SortMode>('quick');
  const [editing, setEditing] = useState<Entry | undefined>();
  const [adding, setAdding] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const settings = data.settings;
  useEffect(() => {
    let alive = true;
    detectSortMode(settings).then((m) => alive && setMode(m));
    return () => {
      alive = false;
    };
  }, [settings]);

  const byId = useMemo(() => new Map(data.entries.map((e) => [e.id, e])), [data.entries]);

  const send = async (msgText?: string) => {
    const message = (msgText ?? text).trim();
    if (!message || busy) return;
    setText('');
    setBusy(true);
    addChat({ role: 'me', text: message });
    const result = await sortMessage(message, data.settings);
    if (!result.fellBack) setMode(result.mode);
    let reply: string;
    if (result.entries.length) {
      addEntries(result.entries);
      const days = new Set(result.entries.map((e) => e.date));
      const when = days.size === 1 ? ` for ${prettyDay([...days][0]).toLowerCase()}` : '';
      reply = `Logged ${result.entries.length} thing${result.entries.length > 1 ? 's' : ''}${when}. Tap one to fix it.`;
      if (result.fellBack) reply += ` (AI sorting didn't answer, so I used quick sort.)`;
    } else {
      reply = "I didn't find anything to log in that. Try something like “2 waters and a protein bar”.";
    }
    addChat({ role: 'app', text: reply, entryIds: result.entries.map((e) => e.id) });
    setBusy(false);
  };

  const undo = (m: ChatMessage) => {
    if (m.entryIds?.length) deleteEntries(m.entryIds);
    updateChat(m.id, { undone: true });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View
        style={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.lg,
          paddingBottom: space.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Title>Log</Title>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: radius.pill,
            backgroundColor: t.surface2,
          }}
        >
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: mode === 'quick' ? t.textFaint : '#45C27A' }} />
          <Text style={{ color: t.textDim, fontSize: 12, fontWeight: '600' }}>{MODE_LABEL[mode]}</Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1, justifyContent: data.chat.length ? 'flex-end' : 'flex-start' }}
        keyboardShouldPersistTaps="handled"
      >
        {!data.chat.length ? (
          <View style={{ gap: space.md }}>
            <Body dim>
              Tell me anything: what you ate, drank, lifted, did, spent, made, or how you feel. One message can cover a bunch of things. On
              iPhone, tap the mic on your keyboard to talk instead of type.
            </Body>
            <View style={{ gap: 8 }}>
              {EXAMPLES.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => send(ex)}
                  style={({ pressed }) => ({
                    padding: 12,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: t.border,
                    backgroundColor: t.surface,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: t.text, fontSize: 14 }}>“{ex}”</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {data.chat.map((m) => {
          const mine = m.role === 'me';
          const entries = (m.entryIds ?? []).map((id) => byId.get(id)).filter(Boolean) as Entry[];
          return (
            <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  maxWidth: '88%',
                  backgroundColor: mine ? t.bubbleMe : t.bubbleApp,
                  borderRadius: radius.lg,
                  borderBottomRightRadius: mine ? 4 : radius.lg,
                  borderBottomLeftRadius: mine ? radius.lg : 4,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: mine ? t.bubbleMeText : t.text, fontSize: 15, lineHeight: 21 }}>
                  {m.undone ? 'Undone. Nothing from that message was kept.' : m.text}
                </Text>
                {!mine && !m.undone && entries.length ? <MessageEntries entries={entries} onEdit={setEditing} /> : null}
                {!mine && !m.undone && entries.length ? (
                  <Pressable onPress={() => undo(m)} style={{ alignSelf: 'flex-start', paddingTop: 8 }} accessibilityRole="button">
                    <Text style={{ color: t.textDim, fontSize: 13, fontWeight: '600' }}>Undo</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
        {busy ? (
          <View style={{ alignItems: 'flex-start' }}>
            <View style={{ backgroundColor: t.bubbleApp, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: t.textDim }}>Sorting…</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 6,
          paddingHorizontal: space.sm,
          paddingVertical: space.sm,
          borderTopWidth: 1,
          borderTopColor: t.border,
          backgroundColor: t.bg,
        }}
      >
        <IconButton icon="add" label="Add by hand" onPress={() => setAdding(true)} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What did you do?"
          placeholderTextColor={t.textFaint}
          multiline
          onSubmitEditing={() => send()}
          blurOnSubmit={false}
          onKeyPress={(e: any) => {
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault?.();
              send();
            }
          }}
          style={{
            flex: 1,
            minHeight: 42,
            maxHeight: 120,
            backgroundColor: t.surface2,
            color: t.text,
            borderRadius: 21,
            paddingHorizontal: 14,
            paddingTop: 11,
            paddingBottom: 11,
            fontSize: 16,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={() => send()}
          disabled={!text.trim() || busy}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !text.trim() || busy ? 0.35 : pressed ? 0.75 : 1,
          })}
        >
          <Icon name="arrow-up" size={22} color={t.accentText} />
        </Pressable>
      </View>

      <EntryEditor visible={!!editing} entry={editing} onClose={() => setEditing(undefined)} />
      <EntryEditor visible={adding} onClose={() => setAdding(false)} />
    </KeyboardAvoidingView>
  );
}
