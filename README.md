# Lifelog

Brogan's personal life tracker. Log anything in plain words (or by hand) and it gets sorted into food, drinks, workouts, activities, business, social, mood, and money, with goal tracking and Congressional Award hours.

Built with Expo (React Native), so the same code runs as an iPhone app (through Expo Go for now) and on the web.

## What's in phase 1

- **Log tab**: a chat box. "Chicken and rice, 2 waters, benched 225 for 5, 1 hr at the gym" becomes separate entries. Tap any entry to fix it, or Undo the whole message.
- **Today tab**: water, meals, workouts, money, mood, and award hours for the day, plus the day's log. Arrows move between days. The + button logs by hand.
- **Goals tab**: Congressional Award tracker (Gold Medal: 400 / 200 / 200 hrs plus the expedition) with an export for your validator, and your own goals that fill in from what you log.
- **History tab**: everything, newest day first, with search and filters.
- **Settings** (gear on Today): award targets and start date, AI sorting connection, backup and restore.

Data is saved on the device for now. Syncing between phone and computer comes with Supabase in a later phase.

## How sorting works

- **Quick sort** (default, free, offline): keyword rules in `src/lib/quickParse.ts`. Handles common phrasing.
- **AI sorting**: the Supabase function in `supabase/functions/parse-log` sends the message to Claude and returns clean entries. The Claude API key stays on the server. Paste the function URL and anon key into Settings to turn it on.
- The web preview published inside Claude uses Claude directly, so it gets AI sorting with no setup.

## Run it on your iPhone (free, no Mac)

1. Install **Expo Go** from the App Store and make a free account at expo.dev.
2. On your computer (needs Node.js): `npm install`, then `npx expo start`. Scan the QR code with your iPhone camera.
3. To open it without your computer running, publish an update: `npx eas-cli@latest login`, `npx eas-cli@latest update:configure`, then `npx eas-cli@latest update --branch main --message "phase 1"`. Open the link it gives you in Expo Go.

## Turn on AI sorting (about $5 of API credit to start)

1. Make a free Supabase project and an Anthropic API key (console.anthropic.com).
2. `npx supabase login`, `npx supabase link --project-ref <your-ref>`
3. `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
4. `npx supabase functions deploy parse-log`
5. In the app: Settings → AI sorting → paste `https://<ref>.supabase.co/functions/v1/parse-log` and your anon key.

## Build the web preview

```
EXPO_OFFLINE=1 npx expo export -p web
python3 scripts/build-preview.py   # writes web-preview/lifelog.html
```

## Project layout

- `src/App.tsx` app shell and tab bar
- `src/screens/` Today, Log, Goals, History, Settings
- `src/components/` entry and goal editors, shared UI
- `src/lib/` storage, store, stats, quick sort, AI sorting, dates
- `supabase/functions/parse-log/` server function for AI sorting

## Later phases

- Supabase database + login so phone and computer share one log
- Apple Health (steps, workouts, sleep) via an iPhone Shortcut now, direct once it's a standalone app
- Wix store sales
- Ask questions about your data ("how many volunteer hours this month?")
- Accounts, payments, App Store
