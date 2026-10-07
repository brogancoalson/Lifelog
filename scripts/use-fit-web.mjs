// Switch this checkout to the Glow Log (fit edition) web build.
// Runs in the Expo workflow before `expo export`, and locally via `npm run web:fit`.
//   1. turns on the fit edition through .env.local (Expo reads it during export)
//   2. swaps in Glow Log's page, home-screen name, and pink icons from public-fit/
// Never commit the result: it only changes files for the build that's running.
import { copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

writeFileSync('.env.local', 'EXPO_PUBLIC_EDITION=fit\n');
for (const f of readdirSync('public-fit')) copyFileSync(join('public-fit', f), join('public', f));
console.log('Glow Log web build ready: .env.local set, public/ swapped from public-fit/');
