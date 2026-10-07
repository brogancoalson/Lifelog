/**
 * Which version of the app this build is.
 *
 * - "full": Brogan's Lifelog (default). Everything: money, trading, award hours, sleep, mood.
 * - "fit":  a simple food + workout tracker for friends. Pink, round, happy. Same logging engine.
 *
 * Set at build time: EXPO_PUBLIC_EDITION=fit npx expo export -p web
 * Expo inlines EXPO_PUBLIC_ variables into the bundle, so this is a constant.
 */
export type Edition = 'full' | 'fit';

export const EDITION: Edition = process.env.EXPO_PUBLIC_EDITION === 'fit' ? 'fit' : 'full';
export const IS_FIT = EDITION === 'fit';

/** Name shown in the app. */
export const APP_NAME = IS_FIT ? 'Glow Log' : 'Lifelog';
