import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Icon } from './components/ui';
import { StoreProvider, useStore } from './lib/store';
import { GoalsScreen } from './screens/GoalsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { LogScreen } from './screens/LogScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AskScreen } from './screens/AskScreen';
import { MoneyScreen } from './screens/MoneyScreen';
import { TodayScreen } from './screens/TodayScreen';
import { TradeScreen } from './screens/TradeScreen';
import { TrackerScreen } from './screens/TrackerScreen';
import { foodCount } from './lib/foodDb';
import { IS_FIT } from './edition';
import type { TrackerKey } from './lib/trackers';
import { font, useInsets, useTheme, upper, ls } from './theme';

type Tab = 'today' | 'log' | 'money' | 'trade' | 'ask' | 'goals';

const ALL_TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: 'today' },
  { key: 'log', label: 'Log', icon: 'chatbubble-ellipses' },
  { key: 'money', label: 'Money', icon: 'wallet' },
  { key: 'trade', label: 'Trade', icon: 'trending-up' },
  { key: 'ask', label: 'Ask', icon: 'sparkles' },
  { key: 'goals', label: 'Goals', icon: 'trophy' },
];

// The fit edition is just food and workouts: Today, Log, and Ask.
const TABS = IS_FIT
  ? ALL_TABS.filter((x) => x.key === 'today' || x.key === 'log' || x.key === 'ask').map((x) => (x.key === 'ask' ? { ...x, label: 'Coach' } : x))
  : ALL_TABS;

function Shell() {
  const t = useTheme();
  const insets = useInsets();
  const { ready } = useStore();
  const [fontsLoaded, fontError] = useFonts(
    IS_FIT ? { Nunito_700Bold, Nunito_800ExtraBold } : { BebasNeue_400Regular, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold },
  );
  const [tab, setTab] = useState<Tab>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tracker, setTracker] = useState<TrackerKey | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const overlay = !!tracker || historyOpen;

  // Android back button closes a detail page instead of leaving the app.
  useEffect(() => {
    if (!overlay) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setTracker(null);
      setHistoryOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [overlay]);

  // Build the 52k-food search index in the background so the first log is instant.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        foodCount();
      } catch {
        // estimates still work from the short list
      }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  // Wait for data and fonts (if fonts fail, carry on with the system font).
  if (!ready || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        {tracker ? <TrackerScreen tracker={tracker} onBack={() => setTracker(null)} /> : null}
        {historyOpen && !tracker ? <HistoryScreen onBack={() => setHistoryOpen(false)} /> : null}
        {!overlay && tab === 'today' ? (
          <TodayScreen
            onOpenSettings={() => setSettingsOpen(true)}
            onGoLog={() => setTab('log')}
            onOpenTracker={setTracker}
            onOpenTab={setTab}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        ) : null}
        {!overlay && tab === 'log' ? <LogScreen /> : null}
        {!overlay && tab === 'money' ? <MoneyScreen /> : null}
        {!overlay && tab === 'trade' ? <TradeScreen /> : null}
        {!overlay && tab === 'ask' ? <AskScreen onOpenSettings={() => setSettingsOpen(true)} /> : null}
        {!overlay && tab === 'goals' ? <GoalsScreen /> : null}
      </View>
      {!overlay ? (
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: t.border,
            backgroundColor: t.surface,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 6),
            paddingTop: 0,
          }}
        >
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                onPress={() => setTab(item.key)}
                style={
                  IS_FIT
                    ? { flex: 1, alignItems: 'center', gap: 2, paddingTop: 8, paddingBottom: 4 }
                    : { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderTopWidth: 3, borderTopColor: active ? t.accent : 'transparent' }
                }
              >
                {IS_FIT ? (
                  // a soft pink pill behind the active tab
                  <View style={{ paddingHorizontal: 18, paddingVertical: 4, borderRadius: 999, backgroundColor: active ? t.surface2 : 'transparent' }}>
                    <Icon name={active ? item.icon : `${item.icon}-outline`} size={22} color={active ? t.accent : t.textFaint} />
                  </View>
                ) : (
                  <Icon name={active ? item.icon : `${item.icon}-outline`} size={22} color={active ? t.text : t.textFaint} />
                )}
                <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.label, letterSpacing: ls(1), textTransform: upper, color: active ? (IS_FIT ? t.accent : t.text) : t.textFaint }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <SettingsScreen visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
