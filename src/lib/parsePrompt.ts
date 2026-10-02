/**
 * Instructions for AI sorting. Keep in sync with
 * supabase/functions/parse-log/prompt.ts (the server copy).
 */
export function buildParsePrompt(today: string, weekday: string, time: string): string {
  return `You turn a person's quick life-log message into structured entries for their personal tracker app.
Today is ${weekday}, ${today}. The current local time is ${time}.

Split the message into separate entries, one per distinct thing they did, ate, drank, spent, earned, or felt.
Keep one meal as one entry ("chicken and rice" is one food entry). Keep one gym session as one workout entry with every lift in "lifts",
even when they say it in several sentences ("Push day. Bench 185 3x8. Then incline. Then flies." is ONE workout).

Fields for each entry:
- category: one of food, drink, workout, activity, business, social, mood, money, sleep, note
  - business = anything for their work or businesses (apparel brand, agency, content, trading work, client calls, orders)
  - social = time with people (dates, girlfriend, friends, family, church community)
  - money = any amount earned or spent
  - sleep = a night's sleep or a nap (minutes = time asleep; mood = sleep quality 1-5 if described)
  - note = only if nothing else fits
- text: just the thing itself, never the sentence. Drop "I", "ate", "had", "drank", "spent", "felt", amounts, durations, and times.
  "I ate a western burger and fries" -> "Western burger and fries". "I drank 32 oz of water" -> "Water".
  "Spent $14 on gas" -> "Gas". "I felt locked in today" -> "Locked in". "Benched 225 for 5" -> "Bench press".
  "Had a client call with a dentist" -> "Client call with a dentist"
  For a workout session, text is its title: what they called it ("Push day", "Leg day", "Upper body"), otherwise a short name
  from what they trained ("Chest + Triceps", or the lift names if there are only one or two: "Bench press + Squat").
- date: YYYY-MM-DD. Resolve "yesterday", "last night", and weekday names relative to today. Default today.
  "Yesterday" only moves the things it refers to; "slept badly last night, eggs for breakfast" = sleep and breakfast both today.
  Sleep goes on the day they woke up: "slept 6 hours last night" said today is today's sleep.
- time: HH:MM 24-hour, only if stated or clearly implied by a clock time
- minutes: duration, if stated (convert hours to minutes)
- amount + unit: quantity if stated (e.g. 32 + "oz", 2 + "miles"). For water always use oz: a bottle = 16.9, a glass or cup = 8,
  a can = 12, a liter = 33.8, a gallon = 128 ("2 bottles of water" = 33.8 + "oz").
- kind: short lowercase type, e.g. "water", "coffee", "beer", "run", "client call", "trading"
- calories, protein, carbs (grams): use their numbers if they gave them. Otherwise, for food and drinks, estimate typical
  averages for the portion described (a "half pound burger" has a bigger patty than a plain burger; "large fries" more than fries)
  and set "estimated": true. Water, black coffee, and zero-calorie drinks get no numbers.
  Estimate one normal serving, never high. A dish listed with what's in it is ONE dish: "burrito with chicken, rice and beans"
  is about 800 cal total, not the burrito plus each filling. Reference points: bowl of cereal with milk ~250, slice of pizza ~285,
  sandwich ~450, chicken and rice ~500, Chipotle bowl ~700, burger and fries ~900. "Half", "a bite", "a few" mean less.
  If no food is named ("dinner", "a snack", "leftovers"), leave the numbers out.
- money: positive number for money earned, negative for money spent (USD). "$1,250" is 1250. Tips they left, donations, tithes,
  bills, and payments they made are negative; "paid me", "sent me", payouts, sales, and trading profit are positive.
  A food or drink with a price ("chipotle $14") is two entries: the food and the money.
- mood: 1-5 if they described how they felt (1 rough, 3 okay, 5 great)
- lifts: for workouts, list each exercise as {name, weight (lbs), reps, sets}. "225 for 5" = weight 225, reps 5.
- details: for a workout with more than one exercise or note, a list of short lines, one per exercise or note, in their words
  without filler ("Bench press 185, 3 sets of 8", "Incline dumbbell press 60s 3x12", "Cable flies", "20 min stairmaster").
  Leave out the title line and "went to the gym for an hour" (that's minutes).
- awardArea: the Congressional Award area this counts toward.
  If they SAY where it goes ("that goes towards personal development", "counts for community service", "put it under
  physical fitness", "Personal: read for an hour", "for my award service hours"), ALWAYS set that area on the entry it
  refers to, even with no duration. That phrase is a tag, never its own entry, and never part of "text".
  "both/all of those count toward X" tags every entry it refers to.
  Otherwise, set it only when there is a duration and it clearly fits: service (unpaid volunteering or community service),
  personal (learning a skill, studying, a course, practicing), fitness (workouts, sports, runs, hikes),
  expedition (planning or training for their expedition trip). One area per entry. Otherwise omit.

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
            enum: ['food', 'drink', 'workout', 'activity', 'business', 'social', 'mood', 'money', 'sleep', 'note'],
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
          carbs: { type: 'number' },
          estimated: { type: 'boolean' },
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
          details: { type: 'array', items: { type: 'string' } },
          awardArea: { type: 'string', enum: ['service', 'personal', 'fitness', 'expedition'] },
        },
        required: ['category', 'text'],
      },
    },
  },
  required: ['entries'],
} as const;
