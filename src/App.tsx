import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
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
import { TodayScreen } from './screens/TodayScreen';
import { TrackerScreen } from './screens/TrackerScreen';
import type { TrackerKey } from './lib/trackers';
import { font, useInsets, useTheme } from './theme';

type Tab = 'today' | 'log' | 'goals' | 'history';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: 'today' },
  { key: 'log', label: 'Log', icon: 'chatbubble-ellipses' },
  { key: 'goals', label: 'Goals', icon: 'trophy' },
  { key: 'history', label: 'History', icon: 'time' },
];

function Shell() {
  const t = useTheme();
  const insets = useInsets();
  const { ready } = useStore();
  const [fontsLoaded, fontError] = useFonts({ BebasNeue_400Regular, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });
  const [tab, setTab] = useState<Tab>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tracker, setTracker] = useState<TrackerKey | null>(null);

  // Android back button closes a tracker page instead of leaving the app.
  useEffect(() => {
    if (!tracker) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setTracker(null);
      return true;
    });
    return () => sub.remove();
  }, [tracker]);

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
        {!tracker && tab === 'today' ? (
          <TodayScreen onOpenSettings={() => setSettingsOpen(true)} onGoLog={() => setTab('log')} onOpenTracker={setTracker} />
        ) : null}
        {!tracker && tab === 'log' ? <LogScreen /> : null}
        {!tracker && tab === 'goals' ? <GoalsScreen /> : null}
        {!tracker && tab === 'history' ? <HistoryScreen /> : null}
      </View>
      {!tracker ? (
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
                style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderTopWidth: 3, borderTopColor: active ? t.accent : 'transparent' }}
              >
                <Icon name={active ? item.icon : `${item.icon}-outline`} size={23} color={active ? t.text : t.textFaint} />
                <Text style={{ fontSize: 13, fontFamily: font.label, letterSpacing: 1.2, textTransform: 'uppercase', color: active ? t.text : t.textFaint }}>
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
