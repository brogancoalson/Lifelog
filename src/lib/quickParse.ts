import type { Category, Entry, Lift } from '../types';
import { addDays, toDay, toTime, uid } from './dates';

/**
 * Offline "quick sort": a keyword-based parser used when AI sorting isn't
 * connected. It handles common phrasing; AI sorting handles everything else.
 */

const RE = {
  moneyAmt: /\$\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:bucks|dollars|usd)\b/i,
  moneyIn: /\b(made|make|sold|earned|got paid|profit|revenue|income|won|received|paid me|tip|tips|commission)\b/i,
  moneyOut: /\b(spent|spend|bought|buy|paid|pay|cost|costs|purchase[d]?|bill|subscription|lost)\b/i,
  mood: /\b(felt|feel|feeling|mood|stressed|anxious|tired|exhausted|happy|sad|motivated|locked in|energized|grateful|blessed|down|burnt out|burned out|frustrated|peaceful|pumped)\b/i,
  workout:
    /\b(bench(?:ed)?|squat(?:ted)?|deadlift(?:ed)?|dl|ohp|overhead press|press(?:ed)?|curl(?:ed)?|rows?|pull-?ups?|push-?ups?|dips|lift(?:ed)?|gym|work(?:ed)? ?out|leg day|chest day|back day|arm day|push day|pull day|ran|run|jog(?:ged)?|miles?|cardio|sprints?|hiit|swim|swam|bike|biked|cycling|stairmaster|incline walk)\b/i,
  business:
    /\b(meeting|client|clients|call with|orders?|sales?|posted|post|reel|video|edited|editing|shipped|invoice|emailed|website|store|shop|wix|unconquered|coverpoint|agency|lead|leads|pitched|outreach|traded|trading|trade|content|filmed|recorded|designed)\b/i,
  social: /\b(date|date night|girlfriend|gf|hung out|hangout|friends?|family|mom|dad|brother|sister|party|dinner with|lunch with|coffee with)\b/i,
  service: /\b(volunteer(?:ed|ing)?|food bank|community service|served at|serving at|helped at|mission|outreach at|soup kitchen|cleanup)\b/i,
  personal: /\b(studied|study|studying|read|reading|course|class|lesson|learned|learning|practiced|practice|bible study|scripture|journaled|boater)\b/i,
  drink:
    /\b(water|waters|coffee|tea|beer|beers|wine|drank|drink|drinks|soda|protein shake|shake|energy drink|monster|celsius|juice|electrolytes|gatorade|liquid iv|smoothie)\b/i,
  food:
    /\b(ate|eat|eating|had|breakfast|lunch|dinner|snack|meal|chicken|rice|eggs?|steak|beef|pizza|burger|salad|oatmeal|oats|sandwich|tacos?|burrito|pasta|fish|salmon|toast|bagel|fruit|banana|apple|yogurt|protein bar|cereal|fries|wings)\b/i,
  activity: /\b(went|did|played|golf(?:ed)?|hiked?|walked|walk|cleaned|drove|fished|fishing|boat|shooting|church|prayed|worked)\b/i,
  yesterday: /\b(yesterday|last night)\b/i,
  hours: /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i,
  mins: /(\d+)\s*(?:m|min|mins|minute|minutes)\b/i,
  halfHour: /\bhalf (?:an )?hour\b/i,
  anHour: /\ban hour\b/i,
  volume: /(\d+(?:\.\d+)?)\s*(oz|ounces?|cups?|bottles?|glasses?|cans?|l|liters?|litres?|ml|gallons?)\b/i,
  countDrink: /\b(\d+|a|an|one|two|three|four|five)\s+(waters|water|coffees?|beers?|drinks?|bottles? of water|glasses? of water)\b/i,
};

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };

function minutesIn(s: string): number | undefined {
  let total = 0;
  const h = s.match(RE.hours);
  const m = s.match(RE.mins);
  if (h) total += parseFloat(h[1]) * 60;
  if (m) total += parseInt(m[1], 10);
  if (!h && RE.halfHour.test(s)) total += 30;
  else if (!h && RE.anHour.test(s)) total += 60;
  return total || undefined;
}

const LIFT_NAMES: [RegExp, string][] = [
  [/bench/i, 'Bench press'],
  [/squat/i, 'Squat'],
  [/deadlift|\bdl\b/i, 'Deadlift'],
  [/ohp|overhead press/i, 'Overhead press'],
  [/curl/i, 'Curl'],
  [/row/i, 'Row'],
  [/pull-?up/i, 'Pull-up'],
  [/push-?up/i, 'Push-up'],
  [/dips/i, 'Dips'],
];

function parseLifts(s: string): Lift[] {
  const lifts: Lift[] = [];
  // split on "and"/"then" so each lift gets its own numbers
  for (const part of s.split(/\band\b|\bthen\b|&|\+/i)) {
    const name = LIFT_NAMES.find(([re]) => re.test(part))?.[1];
    if (!name) continue;
    // "3x5 at 225" / "3x5 @ 225"
    let m = part.match(/(\d+)\s*[x×]\s*(\d+)\s*(?:at|@)\s*(\d+)/i);
    if (m) {
      lifts.push({ name, sets: +m[1], reps: +m[2], weight: +m[3] });
      continue;
    }
    // "225 for 5" / "225x5" / "225 x 5 x 3"
    m = part.match(/(\d{2,4})\s*(?:lbs?|pounds)?\s*(?:x|×|for)\s*(\d{1,2})(?:\s*(?:x|×|for)\s*(\d{1,2}))?/i);
    if (m) {
      lifts.push({ name, weight: +m[1], reps: +m[2], sets: m[3] ? +m[3] : undefined });
      continue;
    }
    // "50 push-ups"
    m = part.match(/(\d+)\s*(?:reps?\s*(?:of)?\s*)?(?:push-?ups?|pull-?ups?|dips)/i);
    if (m) {
      lifts.push({ name, reps: +m[1] });
      continue;
    }
    lifts.push({ name });
  }
  return lifts;
}

function moodScore(s: string): number {
  if (/\b(great|amazing|locked in|pumped|blessed|energized|motivated|awesome|peaceful|grateful)\b/i.test(s)) return 5;
  if (/\b(good|happy|solid|fine|productive)\b/i.test(s)) return 4;
  if (/\b(okay|ok|meh|alright)\b/i.test(s)) return 3;
  if (/\b(tired|stressed|anxious|down|frustrated|low)\b/i.test(s)) return 2;
  if (/\b(terrible|awful|sad|exhausted|burnt out|burned out|depressed)\b/i.test(s)) return 1;
  return 3;
}

function drinkKind(s: string): string | undefined {
  const m = s.match(/\b(water|coffee|tea|beer|wine|soda|protein shake|shake|energy drink|monster|celsius|juice|electrolytes|gatorade|smoothie)\b/i);
  return m ? m[1].toLowerCase() : undefined;
}

function clean(s: string): string {
  let t = s
    .trim()
    .replace(/^(and|then|also|plus|i|i've|ive|just)\s+/i, '')
    .replace(/\s+(today|yesterday|last night)$/i, '')
    .replace(/[.!]+$/, '')
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function classify(s: string): Category {
  const hasMoney = RE.moneyAmt.test(s) && (RE.moneyIn.test(s) || RE.moneyOut.test(s));
  if (hasMoney) return 'money';
  if (RE.workout.test(s)) return 'workout';
  if (RE.service.test(s) || RE.personal.test(s)) return 'activity';
  if (RE.social.test(s)) return 'social';
  if (RE.business.test(s)) return 'business';
  if (RE.drink.test(s) && !/\b(ate|breakfast|lunch|dinner)\b/i.test(s)) return 'drink';
  if (RE.food.test(s)) return 'food';
  if (RE.mood.test(s)) return 'mood';
  if (RE.activity.test(s) || minutesIn(s)) return 'activity';
  return 'note';
}

export function quickParse(message: string, now: Date = new Date()): Entry[] {
  const today = toDay(now);
  const globalYesterday = RE.yesterday.test(message);
  const chunks = message
    .split(/\n|;|,|\.\s+|\bthen\b/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 1);

  const out: Entry[] = [];
  for (const chunk of chunks) {
    const category = classify(chunk);
    const date = RE.yesterday.test(chunk) || globalYesterday ? addDays(today, -1) : today;
    const e: Entry = {
      id: uid(),
      createdAt: now.toISOString(),
      date,
      time: date === today ? toTime(now) : undefined,
      category,
      text: clean(chunk),
      source: 'chat',
    };
    const minutes = minutesIn(chunk);
    if (minutes) e.minutes = minutes;

    if (category === 'money') {
      const m = chunk.match(RE.moneyAmt)!;
      const amt = parseFloat((m[1] ?? m[2]).replace(/,/g, ''));
      const isIn = RE.moneyIn.test(chunk) && !/\b(spent|bought|paid for|cost)\b/i.test(chunk);
      e.money = isIn ? amt : -amt;
      if (/\b(order|sale|sold|store|shirt|hoodie|unconquered)\b/i.test(chunk)) e.kind = 'business';
      if (/\btrad(e|ed|ing)\b/i.test(chunk)) e.kind = 'trading';
    }
    if (category === 'workout') {
      const lifts = parseLifts(chunk);
      if (lifts.length) e.lifts = lifts;
      const miles = chunk.match(/(\d+(?:\.\d+)?)\s*(?:mi|miles?)\b/i);
      if (miles) {
        e.amount = parseFloat(miles[1]);
        e.unit = 'miles';
      }
      if (e.minutes) e.awardArea = 'fitness';
    }
    if (category === 'drink') {
      const v = chunk.match(RE.volume);
      const c = chunk.match(RE.countDrink);
      if (v) {
        e.amount = parseFloat(v[1]);
        e.unit = v[2].toLowerCase().replace(/^ounces?$/, 'oz');
      } else if (c) {
        const n = WORD_NUM[c[1].toLowerCase()] ?? parseInt(c[1], 10);
        const isWater = /water/i.test(c[2]);
        e.amount = isWater ? n * 16.9 : n;
        e.unit = isWater ? 'oz' : 'drinks';
      }
      e.kind = drinkKind(chunk);
    }
    if (category === 'mood') e.mood = moodScore(chunk);
    if (category === 'activity') {
      if (RE.service.test(chunk)) e.awardArea = e.minutes ? 'service' : undefined;
      else if (RE.personal.test(chunk)) e.awardArea = e.minutes ? 'personal' : undefined;
    }
    // "benched 225x5, 1 hr at the gym" -> one workout with a duration, not two entries
    const prev = out[out.length - 1];
    if (prev && prev.category === 'workout' && category === 'workout' && !e.lifts && e.minutes && !prev.minutes && prev.date === e.date) {
      prev.minutes = e.minutes;
      prev.awardArea = 'fitness';
      continue;
    }
    out.push(e);
  }
  return out;
}
