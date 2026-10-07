import React, { useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useImageUri } from '../lib/imageStore';
import { radius, space, useTheme } from '../theme';
import type { ChatMessage } from '../types';
import { Icon, IconButton } from './ui';

export interface PendingImage {
  id: string;
  uri: string;
  base64: string;
}

function Thumb({ id, size = 64 }: { id: string; size?: number }) {
  const t = useTheme();
  const uri = useImageUri(id);
  return (
    <View style={{ width: size, height: size, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.border, borderRadius: radius.md, overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: size - 2, height: size - 2 }} resizeMode="cover" /> : null}
    </View>
  );
}

export { Thumb };

/** A chat screen body: message list + composer. Used by Ask and the trading journal. */
export function ChatThread({
  messages,
  busy,
  busyText,
  onSend,
  placeholder,
  empty,
  onPickImages,
  renderBelow,
}: {
  messages: ChatMessage[];
  busy: boolean;
  busyText?: string;
  onSend: (text: string, images: PendingImage[]) => void;
  placeholder: string;
  empty?: React.ReactNode;
  onPickImages?: () => Promise<PendingImage[]>;
  renderBelow?: (m: ChatMessage) => React.ReactNode;
}) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [typing, setTyping] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  const send = (override?: string) => {
    const body = (override ?? text).trim();
    if ((!body && !pending.length) || busy) return;
    onSend(body, pending);
    setText('');
    setPending([]);
  };

  const canSend = (!!text.trim() || pending.length > 0) && !busy;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1, justifyContent: messages.length ? 'flex-end' : 'flex-start' }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {!messages.length && empty ? <View>{typeof empty === 'function' ? null : empty}</View> : null}
        {messages.map((m) => {
          const mine = m.role === 'me';
          return (
            <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 6 }}>
              {m.images?.length ? (
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  {m.images.map((id) => (
                    <Thumb key={id} id={id} size={88} />
                  ))}
                </View>
              ) : null}
              {m.text ? (
                <View
                  style={{
                    maxWidth: '92%',
                    backgroundColor: mine ? t.bubbleMe : t.bubbleApp,
                    borderWidth: mine ? 0 : 1,
                    borderColor: t.border,
                    borderRadius: radius.lg,
                    // the little tail corner on the sender's side
                    borderBottomRightRadius: mine ? Math.min(radius.lg, 6) : radius.lg,
                    borderBottomLeftRadius: mine ? radius.lg : Math.min(radius.lg, 6),
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Text selectable style={{ color: mine ? t.bubbleMeText : t.text, fontSize: 15, lineHeight: 22 }}>
                    {m.text}
                  </Text>
                  {!mine && renderBelow ? renderBelow(m) : null}
                </View>
              ) : null}
            </View>
          );
        })}
        {busy ? (
          <View style={{ alignItems: 'flex-start' }}>
            <View style={{ backgroundColor: t.bubbleApp, borderWidth: 1, borderColor: t.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: t.textDim }}>{busyText ?? 'Thinking…'}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {pending.length ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.md, paddingTop: 8, flexWrap: 'wrap' }}>
          {pending.map((p) => (
            <View key={p.id}>
              <Image source={{ uri: p.uri }} style={{ width: 56, height: 56, borderWidth: 1, borderColor: t.border }} />
              <Pressable
                onPress={() => setPending((l) => l.filter((x) => x.id !== p.id))}
                accessibilityLabel="Remove screenshot"
                style={{ position: 'absolute', top: -8, right: -8, backgroundColor: t.bg, borderRadius: radius.pill }}
              >
                <Icon name="close-circle" size={20} color={t.textDim} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

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
        {typing ? (
          <IconButton
            icon="chevron-down"
            label="Hide keyboard"
            onPress={() => {
              input.current?.blur();
              Keyboard.dismiss();
            }}
            style={{ borderWidth: 1, borderColor: t.borderStrong, width: 42, height: 42 }}
          />
        ) : onPickImages ? (
          <IconButton
            icon="image-outline"
            label="Add screenshots"
            onPress={async () => {
              const imgs = await onPickImages();
              if (imgs.length) setPending((l) => [...l, ...imgs].slice(0, 4));
            }}
          />
        ) : null}
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={t.textFaint}
          multiline
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setTyping(true);
          }}
          onBlur={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            blurTimer.current = setTimeout(() => setTyping(false), 300);
          }}
          onKeyPress={(e: any) => {
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault?.();
              send();
            }
          }}
          style={{
            flex: 1,
            minHeight: 42,
            maxHeight: 140,
            backgroundColor: t.surface2,
            color: t.text,
            borderRadius: radius.lg,
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
          disabled={!canSend}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: radius.pill,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !canSend ? 0.35 : pressed ? 0.75 : 1,
          })}
        >
          <Icon name="arrow-up" size={22} color={t.accentText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Tappable example prompts for an empty chat. */
export function Examples({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((ex) => (
        <Pressable
          key={ex}
          onPress={() => onPick(ex)}
          style={({ pressed }) => ({ padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ color: t.text, fontSize: 14 }}>“{ex}”</Text>
        </Pressable>
      ))}
    </View>
  );
}
