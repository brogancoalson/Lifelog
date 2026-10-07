import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChatThread, Examples } from '../components/ChatThread';
import { Body, Card, Title } from '../components/ui';
import { ask, askMode, type AskMode } from '../lib/ask';
import { useStore } from '../lib/store';
import { IS_FIT } from '../edition';
import { font, space, useInsets, useTheme, upper, ls } from '../theme';

const EXAMPLES = IS_FIT ? [
  'What’s an easy high-protein snack I could have right now?',
  'How’s my protein been this week?',
  'Plan my next workout from what I did this week.',
  'Am I drinking enough water?',
  'Give me 3 easy lunch ideas around 500 calories.',
] : [
  'What should I eat tonight to hit my protein?',
  'Which muscle groups am I neglecting? Plan my next workout.',
  'How was my sleep this last week, and what should I change?',
  'Where did my money go since my last paycheck?',
  'What patterns show up in my losing trades?',
  'Am I on pace for Congressional Award Gold? What do I need each week?',
];

const STEP_TEXT: Record<string, string> = {
  overview: 'Checking what you’ve logged…',
  daily_summaries: 'Reading your days…',
  entries: 'Looking through entries…',
  money: 'Checking your buckets…',
  trades: 'Reading your trading journal…',
  goals: 'Checking your goals…',
  training: 'Checking your lifts…',
  nutrition: 'Checking what you’ve been eating…',
  food_lookup: 'Looking up foods…',
};

export function AskScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useTheme();
  const insets = useInsets();
  const { data, addChat, clearChat } = useStore();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | undefined>();
  const [mode, setMode] = useState<AskMode | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const key = data.settings.claudeKey;
  useEffect(() => {
    let alive = true;
    askMode(data).then((m) => alive && setMode(m));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const send = async (text: string) => {
    if (!text || busy) return;
    const history = data.askChat;
    addChat({ role: 'me', text }, 'askChat');
    setBusy(true);
    setStep(undefined);
    try {
      const answer = await ask(text, history, data, (s) => setStep(STEP_TEXT[s] ?? 'Looking that up…'));
      addChat({ role: 'app', text: answer }, 'askChat');
    } catch (e: any) {
      addChat(
        {
          role: 'app',
          text:
            e?.message === 'NO_AI'
              ? IS_FIT
                ? 'Coach needs the AI helper to answer. Add a Claude API key in Settings, then ask again.'
                : 'Ask needs a Claude connection to answer. Add your Claude API key in Settings, then ask again.'
              : e?.message ?? 'Something went wrong. Try again.',
          error: true,
        },
        'askChat',
      );
    }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title>{IS_FIT ? 'Coach' : 'Ask'}</Title>
        {data.askChat.length ? (
          confirmClear ? (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={() => setConfirmClear(false)}>
                <Text style={{ color: t.textDim, fontFamily: font.labelBold, fontSize: 15, letterSpacing: ls(1), textTransform: upper }}>Keep</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  clearChat('askChat');
                  setConfirmClear(false);
                }}
              >
                <Text style={{ color: t.danger, fontFamily: font.labelBold, fontSize: 15, letterSpacing: ls(1), textTransform: upper }}>Clear chat</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmClear(true)} hitSlop={8}>
              <Text style={{ color: t.textDim, fontFamily: font.label, fontSize: 14, letterSpacing: ls(1), textTransform: upper }}>New chat</Text>
            </Pressable>
          )
        ) : null}
      </View>
      <ChatThread
        messages={data.askChat}
        busy={busy}
        busyText={step ?? 'Thinking…'}
        onSend={(text) => send(text)}
        placeholder={IS_FIT ? 'Ask your coach anything' : 'Ask about your data or for advice'}
        empty={
          <View style={{ gap: space.md }}>
            <Body dim>
              {IS_FIT
                ? 'Ask about anything you’ve logged, or ask for meal ideas and workout plans. It checks your real numbers first. Add your goals under About you in Settings for better advice.'
                : 'Ask about anything you’ve logged, or ask for advice. It looks up your real numbers first, then gives you a report or a plan. Add your weight and targets under About you in Settings for better advice.'}
            </Body>
            {mode === 'none' ? (
              <Card style={{ gap: 8, borderColor: t.accent }}>
                <Text style={{ color: t.text, fontFamily: font.labelBold, fontSize: 17, letterSpacing: ls(1), textTransform: upper }}>{IS_FIT ? 'Turn on the AI helper' : 'Connect Claude first'}</Text>
                <Body dim style={{ fontSize: 14 }}>
                  Answers come from Claude. Add your own Claude API key in Settings (a question costs a few cents). Your key stays on this phone.
                </Body>
                <Pressable onPress={onOpenSettings} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
                  <Text style={{ color: t.accentInk, fontFamily: font.labelBold, fontSize: 16, letterSpacing: ls(1), textTransform: upper }}>Open Settings</Text>
                </Pressable>
              </Card>
            ) : null}
            <Examples items={EXAMPLES} onPick={(q) => send(q)} />
          </View>
        }
      />
    </View>
  );
}
