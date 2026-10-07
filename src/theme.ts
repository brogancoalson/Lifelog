import { useSyncExternalStore } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_FIT } from './edition';

// Hard look: near-black iron, bone text, dried-blood accent, square edges.
const dark = {
  bg: '#0B0B0A',
  surface: '#141412',
  surface2: '#1E1D1A',
  border: '#36332E',
  borderStrong: '#4A463F',
  text: '#E6E1D6',
  textDim: '#9C968B',
  textFaint: '#67635B',
  accent: '#A8352B',
  accentText: '#F0EBE0',
  good: '#5E8C52',
  danger: '#C24A34',
  bubbleMe: '#A8352B',
  bubbleMeText: '#F0EBE0',
  bubbleApp: '#1E1D1A',
  overlay: 'rgba(0,0,0,0.7)',
};

const light: typeof dark = {
  bg: '#E7E3DA',
  surface: '#F1EEE7',
  surface2: '#DDD8CD',
  border: '#C4BEB2',
  borderStrong: '#A59F92',
  text: '#151412',
  textDim: '#57534C',
  textFaint: '#857F75',
  accent: '#8E2A22',
  accentText: '#F4F0E8',
  good: '#4A7641',
  danger: '#A63A27',
  bubbleMe: '#8E2A22',
  bubbleMeText: '#F4F0E8',
  bubbleApp: '#DDD8CD',
  overlay: 'rgba(0,0,0,0.45)',
};

export type Theme = typeof dark;

// Fit edition: soft pink, white cards, happy and light.
const fitLight: Theme = {
  bg: '#FFF4F7',
  surface: '#FFFFFF',
  surface2: '#FFE8F0',
  border: '#F8D7E3',
  borderStrong: '#EFB3C9',
  text: '#3D2933',
  textDim: '#86677A',
  textFaint: '#B496A6',
  accent: '#E8578D',
  accentText: '#FFFFFF',
  good: '#3FA97C',
  danger: '#DC4B65',
  bubbleMe: '#E8578D',
  bubbleMeText: '#FFFFFF',
  bubbleApp: '#FFE8F0',
  overlay: 'rgba(70,25,45,0.35)',
};

const fitDark: Theme = {
  bg: '#1F1520',
  surface: '#2B1E2D',
  surface2: '#38273B',
  border: '#4A3550',
  borderStrong: '#634769',
  text: '#FCEFF5',
  textDim: '#CDB1C2',
  textFaint: '#937A8C',
  accent: '#FF7FAF',
  accentText: '#2B0E1C',
  good: '#6BD0A3',
  danger: '#FF7A8C',
  bubbleMe: '#FF7FAF',
  bubbleMeText: '#2B0E1C',
  bubbleApp: '#38273B',
  overlay: 'rgba(0,0,0,0.55)',
};

// Typefaces: Bebas Neue for titles and big numbers, Barlow Condensed for labels and buttons.
// Fit edition: Nunito, a soft rounded font.
export const font = IS_FIT
  ? { display: 'Nunito_800ExtraBold', label: 'Nunito_700Bold', labelBold: 'Nunito_800ExtraBold' }
  : { display: 'BebasNeue_400Regular', label: 'BarlowCondensed_600SemiBold', labelBold: 'BarlowCondensed_700Bold' };

/** Labels and buttons: ALL CAPS in Lifelog, normal case in the fit edition. */
export const upper: 'uppercase' | 'none' = IS_FIT ? 'none' : 'uppercase';
/** Letter spacing for the caps look; the rounded font needs none. */
export const ls = (n: number) => (IS_FIT ? 0 : n);
/** Big-number sizes: Nunito is much wider than Bebas Neue, so scale it down. */
export const ds = (n: number) => (IS_FIT ? Math.round(n * 0.78) : n);

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
  if (IS_FIT) return scheme === 'dark' ? fitDark : fitLight;
  return scheme === 'light' ? light : dark;
}

/** Safe-area insets on the phone. The web page handles its own insets. */
export function useInsets() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? { top: 0, bottom: 0, left: 0, right: 0 } : insets;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
// Square edges everywhere in Lifelog; soft round corners in the fit edition.
export const radius = IS_FIT ? { sm: 10, md: 16, lg: 22, pill: 999 } : { sm: 0, md: 0, lg: 0, pill: 0 };
