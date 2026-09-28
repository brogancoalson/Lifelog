/**
 * Instructions for AI sorting. Keep in sync with
 * supabase/functions/parse-log/prompt.ts (the server copy).
 */
export function buildParsePrompt(today: string, weekday: string, time: string): string {
  return `You turn a person's quick life-log message into structured entries for their personal tracker app.
Today is ${weekday}, ${today}. The current local time is ${time}.

Split the message into separate entries, one per distinct thing they did, ate, drank, spent, earned, or felt.
Keep one meal as one entry ("chicken and rice" is one food entry). Keep one gym session as one workout entry with every lift in "lifts".

Fields for each entry:
- category: one of food, drink, workout, activity, business, social, mood, money, note
  - business = anything for their work or businesses (apparel brand, agency, content, trading work, client calls, orders)
  - social = time with people (dates, girlfriend, friends, family, church community)
  - money = any amount earned or spent
  - note = only if nothing else fits
- text: just the thing itself, never the sentence. Drop "I", "ate", "had", "drank", "spent", "felt", amounts, durations, and times.
  "I ate a western burger and fries" -> "Western burger and fries". "I drank 32 oz of water" -> "Water".
  "Spent $14 on gas" -> "Gas". "I felt locked in today" -> "Locked in". "Benched 225 for 5" -> "Bench press".
  "Had a client call with a dentist" -> "Client call with a dentist"
- date: YYYY-MM-DD. Resolve "yesterday", "last night", and weekday names relative to today. Default today.
- time: HH:MM 24-hour, only if stated or clearly implied by a clock time
- minutes: duration, if stated (convert hours to minutes)
- amount + unit: quantity if stated (e.g. 32 + "oz", 2 + "miles"). For "2 bottles of water" use 33.8 + "oz".
- kind: short lowercase type, e.g. "water", "coffee", "beer", "run", "client call", "trading"
- calories, protein (grams): only if they stated them. Never guess.
- money: positive number for money earned, negative for money spent (USD)
- mood: 1-5 if they described how they felt (1 rough, 3 okay, 5 great)
- lifts: for workouts, list each exercise as {name, weight (lbs), reps, sets}. "225 for 5" = weight 225, reps 5.
- awardArea: the Congressional Award area this counts toward, ONLY when there is a duration and it clearly fits:
  service (unpaid volunteering or community service), personal (learning a skill, studying, a course, practicing),
  fitness (workouts, sports, runs), expedition (planning or training for their expedition trip). One area per entry. Otherwise omit.

Never invent details they didn't say. If the message is a question or not something to log, return no entries.`;
}

export const ENTRY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['food', 'drink', 'workout', 'activity', 'business', 'social', 'mood', 'money', 'note'],
          },
          text: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          minutes: { type: 'number' },
          amount: { type: 'number' },
          unit: { type: 'string' },
          kind: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          money: { type: 'number' },
          mood: { type: 'number' },
          lifts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                weight: { type: 'number' },
                reps: { type: 'number' },
                sets: { type: 'number' },
              },
              required: ['name'],
            },
          },
          awardArea: { type: 'string', enum: ['service', 'personal', 'fitness', 'expedition'] },
        },
        required: ['category', 'text'],
      },
    },
  },
  required: ['entries'],
} as const;
