import { useSyncExternalStore } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const dark = {
  bg: '#0E0F11',
  surface: '#17191C',
  surface2: '#202328',
  border: '#2A2E34',
  text: '#F2F3F5',
  textDim: '#9BA1A9',
  textFaint: '#6B7078',
  accent: '#D4A537',
  accentText: '#0E0F11',
  danger: '#EF5B5B',
  bubbleMe: '#D4A537',
  bubbleMeText: '#0E0F11',
  bubbleApp: '#202328',
  overlay: 'rgba(0,0,0,0.6)',
};

const light: typeof dark = {
  bg: '#F6F6F4',
  surface: '#FFFFFF',
  surface2: '#EFEFEC',
  border: '#E2E2DE',
  text: '#15171A',
  textDim: '#5F646C',
  textFaint: '#8A8F97',
  accent: '#B8891A',
  accentText: '#FFFFFF',
  danger: '#D93C3C',
  bubbleMe: '#B8891A',
  bubbleMeText: '#FFFFFF',
  bubbleApp: '#EFEFEC',
  overlay: 'rgba(0,0,0,0.35)',
};

export type Theme = typeof dark;

// On the web, a host page can force light/dark with <html data-theme="...">.
// One shared observer keeps every component in step with it.
type Forced = 'light' | 'dark' | null;
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
const readForced = (): Forced => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const v = document.documentElement.getAttribute('data-theme');
  return v === 'light' || v === 'dark' ? v : null;
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  if (!observer && Platform.OS === 'web' && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    observer = new MutationObserver(() => listeners.forEach((l) => l()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  return () => {
    listeners.delete(cb);
  };
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const forced = useSyncExternalStore(subscribe, readForced, () => null);
  const scheme = forced ?? system;
  return scheme === 'light' ? light : dark;
}

/** Safe-area insets on the phone. The web page handles its own insets. */
export function useInsets() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? { top: 0, bottom: 0, left: 0, right: 0 } : insets;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
