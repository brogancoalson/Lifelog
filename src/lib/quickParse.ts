import type { AwardArea, Category, Entry } from '../types';
import { explicitAward, isTagOnly, mentionsAward, stripAwardTag, taggable, tagCoversAll } from './awardTag';
import { addDays, toDay, toTime, uid } from './dates';
import { isCuratedFood, withEstimate } from './nutrition';
import { bulletLines, isExercise, isSessionLength, liftsFromLines, parseLifts, sessionFromLines } from './workout';

/**
 * Offline "quick sort": a keyword-based parser used when AI sorting isn't
 * connected. It handles common phrasing; AI sorting handles everything else.
 */

const RE = {
  sleep: /\b(slept|sleep|asleep|nap|napped|went to bed|bed at|woke up|wake up|woke at)\b/i,
  // every way an amount of money gets written: $1,250  $7.25  $5k  40 bucks  2 grand
  moneyAll: /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?k\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:bucks|dollars|usd|grand)\b/gi,
  // clearly money coming in, checked first ("paid me" beats "paid")
  moneyInStrong:
    /\b(got paid|paid me|pay me|paid (?:me )?back|sent me|gave me|venmo(?:ed|'d)? me|zelle(?:d|'d)? me|cash ?app(?:ed|'d)? me|earned|received|sold|won|profit|revenue|income|commission|refund(?:ed)?|payout|paycheck|made \$|made \d|up \$|up \d|got \$|got an? \$|in tips|\d+ (?:orders|sales))\b/i,
  moneyOut:
    /\b(spent|spend|bought|buy|paid|pay|payment|donat(?:ed|ion|e)|tithe|gave|tipped|left an?|bill|rent|subscription|cost|costs|purchased?|lost|loss|down \$|down \d|venmo(?:ed|'d)?|zelle(?:d)?|sent|fee|fine|ticket|owed?)\b/i,
  moneyInWeak: /\b(made|make|got|tips|tip money)\b/i,
  moneyRate: /\$\s?\d[\d,.]*\s*(?:\/|an?|per)\s*(?:hour|hr|h|day|week|month)\b/i,
  mood: /\b(felt|feel|feeling|mood|stressed|anxious|tired|exhausted|happy|sad|motivated|locked in|energized|grateful|blessed|down|burnt out|burned out|frustrated|peaceful|pumped|(?:great|good|bad|rough|long|amazing|terrible|awful) day)\b/i,
  workout:
    /\b(bench(?:ed)?|squats?|squatted|deadlifts?|deadlifted|dl|ohp|overhead press|pull ?downs?|lat pull|rdls?|lunges?|leg curls?|leg ext(?:ension)?s?|flyes|flys|lateral raises?|lat raises?|shrugs?|hip thrusts?|calf raises?|skull ?crushers?|triceps?|push ?downs?|preacher|(?:bench|leg|military|shoulder|incline|decline|dumbbell|db|chest|push) press(?:ed)?|curls?|curled|rows?|pull[- ]?ups?|push[- ]?ups?|chin[- ]?ups?|dips|lifts?|lifted|lifting|gym|work(?:ed)? ?out|leg day|chest day|back day|arm day|push day|pull day|ran|run|jog(?:ged)?|miles?|cardio|sprints?|hiit|swim|swam|bike|biked|cycling|stairmaster|incline walk|(?:hit|trained|did|worked)\s+(?:legs|chest|back|arms|shoulders|abs|core|glutes|upper(?: body)?|lower(?: body)?)|hike|hiked|hiking|basketball|football|soccer|tennis|pickleball|volleyball|baseball|softball|hockey|wrestling|boxing|jiu ?jitsu|bjj|mma|climbing|bouldering|yoga|pilates|skated|skating|surfed|surfing|fl(?:ies|ys|yes)|cable (?:fl(?:y|ies|yes|ys)|rows?|curls?|crossovers?|pull|push|kickbacks?|raises?|laterals?)|crossovers?|crunch(?:es)?|planks?|sit[- ]?ups?|face pulls?|kickbacks?|pullovers?|super ?sets?|drop ?sets?|treadmill|elliptical|incline|(?:tricep|triceps|leg|front|rear delt|hanging leg) (?:raises?|extensions?)|\d+\s*[x×]\s*\d+|\d+\s*sets?|\d+\s*reps?|reps)\b/i,
  business:
    /\b(meeting|client|clients|call with|orders?|sales?|posted|post|reel|video|edited|editing|shipped|invoice|emailed|website|my store|online store|my shop|wix|unconquered|coverpoint|agency|lead|leads|pitched|outreach|traded|trading|trade|content|filmed|recorded|designed)\b/i,
  social: /\b(date|date night|girlfriend|gf|hung out|hangout|friends?|family|mom|dad|brother|sister|party|dinner with|lunch with|coffee with)\b/i,
  service: /\b(volunteer(?:ed|ing)?|food bank|community service|served at|serving at|helped at|mission|outreach at|soup kitchen|cleanup)\b/i,
  personal: /\b(studied|study|studying|read|reading|course|class|lesson|learned|learning|practiced|practice|bible study|scripture|journaled|boater)\b/i,
  drink:
    /\b(water|waters|coffees?|teas?|beers?|wines?|drank|drink|drinks|sodas?|protein shakes?|shakes?|energy drinks?|monsters?|celsius(?:es)?|juices?|electrolytes|gatorades?|powerade|liquid iv|smoothies?|white claws?|seltzers?|twisted teas?|margaritas?|cocktails?|lattes?|cappuccinos?|espressos?|frappuccinos?|matcha|kombucha|milk|chocolate milk|lemonade|red ?bulls?|body ?armor|sparkling water)\b/i,
  food:
    /\b(ate|eat|eating|had|breakfast|lunch|dinner|snack|meal|chicken|rice|eggs?|steak|beef|pizza|burger|salad|oatmeal|oats|sandwich|tacos?|burrito|pasta|fish|salmon|toast|bagel|fruit|banana|apple|yogurt|protein bar|cereal|fries|wings)\b/i,
  activity: /\b(went|did|played|golf(?:ed)?|hiked?|walked|walk|cleaned|drove|fished|fishing|boat|shooting|church|prayed|worked|errands?|shopping|store)\b/i,
  yesterday: /\b(yesterday|last night)\b/i,
  hours: /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i,
  mins: /(\d+)\s*(?:m|min|mins|minute|minutes)\b/i,
  halfHour: /\bhalf (?:an )?hour\b/i,
  anHour: /\b(?:an|one|a full)\s+hour\b|^\s*hour\b/i,
  volume: /(\d+(?:\.\d+)?)\s*(oz|ounces?|cups?|bottles?|glasses?|cans?|l|liters?|litres?|ml|gallons?)\b/i,
  countDrink: /\b(\d+|a|an|one|two|three|four|five|a couple(?: of)?)\s+(waters|water|coffees?|beers?|drinks?|(?:bottles?|glass(?:es)?|cans?|cups?|mugs?) of water)\b/i,
};

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, 'a couple': 2, 'a couple of': 2 };
const NUM_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30', forty: '40', 'forty five': '45', 'forty-five': '45', fifty: '50', sixty: '60', ninety: '90' };
/** oz in one container of water */
const CONTAINER_OZ = (what: string) => (/glass|cup/i.test(what) ? 8 : /can|mug/i.test(what) ? 12 : 16.9);

function minutesIn(s0: string): number | undefined {
  // "seven hours" -> "7 hours"
  const s = s0.replace(/\b(forty[- ]five|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety)\b(?=\s+(?:and a half\s+)?(?:hours?|hrs?|minutes?|mins?)\b)/gi, (w) => NUM_WORDS[w.toLowerCase()]);
  // "2h30", "1h 15m"
  const hm = s.match(/\b(\d+)\s*h\s*(\d{1,2})\s*(?:m|min|mins)?\b/i);
  if (hm) return +hm[1] * 60 + +hm[2];
  const andHalf = s.match(/\b(an?|one|\d+)\s+(?:and a half\s+(?:h|hr|hrs|hours?)|(?:h|hr|hrs|hours?)\s+and a half)\b/i);
  if (andHalf) {
    const n = /^(an?|one)$/i.test(andHalf[1]) ? 1 : parseInt(andHalf[1], 10);
    return (n + 0.5) * 60;
  }
  let total = 0;
  const h = s.match(RE.hours);
  const m = s.match(RE.mins);
  if (h) total += parseFloat(h[1]) * 60;
  if (m) total += parseInt(m[1], 10);
  if (!h && RE.halfHour.test(s)) total += 30;
  else if (!h && RE.anHour.test(s)) total += 60;
  return total || undefined;
}

function moodScore(s: string): number {
  if (/\b(great|amazing|locked in|pumped|blessed|energized|motivated|awesome|peaceful|grateful)\b/i.test(s)) return 5;
  if (/\b(good|happy|solid|fine|productive|strong|confident)\b/i.test(s)) return 4;
  if (/\b(okay|ok|meh|alright)\b/i.test(s)) return 3;
  if (/\b(tired|stressed|anxious|down|frustrated|low|bad|rough|long)\b/i.test(s)) return 2;
  if (/\b(terrible|awful|sad|exhausted|burnt out|burned out|depressed)\b/i.test(s)) return 1;
  return 3;
}

function drinkKind(s: string): string | undefined {
  const m = s.match(/\b(water|coffee|tea|beer|wine|soda|protein shake|shake|energy drink|monster|celsius|juice|electrolytes|gatorade|smoothie)\b/i);
  return m ? m[1].toLowerCase() : undefined;
}

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Remove the parts of a sentence that aren't the thing itself: "I", times of day, durations. */
function stripCommon(s: string): string {
  let t = ` ${s.trim()} `;
  t = t.replace(/[.!?]+(\s|$)/g, ' ');
  t = t.replace(/\b(today|yesterday|last night|this morning|this afternoon|this evening|tonight|earlier|just now|this week|last week|this month|last month)\b/gi, ' ');
  t = t.replace(/\b(for\s+)?(about\s+|like\s+|around\s+)?(an?|one|\d+)\s+(and a half\s+(hours?|hrs?|h)|(hours?|hrs?|h)\s+and a half)\b/gi, ' ');
  t = t.replace(/\b(for\s+)?(about\s+|like\s+|around\s+)?\d+\s*h\s*\d{1,2}\s*(m|min|mins)?\b/gi, ' ');
  t = t.replace(/\b(for\s+)?(about\s+|like\s+|around\s+)?(\d+(\.\d+)?|an?|half an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b(\s+of\b)?/gi, ' ');
  // "chicken and rice after the gym" -> "chicken and rice"
  t = t.replace(/\b(after|before|post|pre)[- ]?(the |my |a |our )?(gym|workout|work out|lift|lifting|run|practice|training|game|session)\b/gi, ' ');
  t = t.trim();
  // leading fillers and "I"
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/^(and|then|also|plus|so|just|finally|ok|okay)\s+/i, '')
      .replace(/^(i|i've|ive|i'm|im|we|we've|me)\s+(just\s+|also\s+|finally\s+)?/i, '');
  }
  // dangling words left at the end ("at the gym for" -> "at the gym")
  t = t.replace(/\s+(for|at|with|and|to)\s*$/i, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

const stripArticle = (t: string) => t.replace(/^(a|an|some|the|my|a few|a couple of|couple)\s+/i, '');

/** The name of the thing: "I ate a western burger and fries" -> "Western burger and fries". */
export function itemText(category: Category, chunk: string, e: Partial<Entry> = {}): string {
  let t = stripCommon(chunk);
  switch (category) {
    case 'food': {
      t = t.replace(/^(ate|eat|eating|had|have|having|got|grabbed|made|cooked|finished|devoured|snacked on)\s+/i, '');
      t = t.replace(/\s*\b(for|as)\s+(my\s+)?(breakfast|lunch|dinner|brunch|a snack|snack|dessert|a meal|pre-workout|post-workout)\b/gi, '');
      t = stripArticle(t.trim());
      if (!t) t = (chunk.match(/\b(breakfast|lunch|dinner|brunch|snack|dessert)\b/i)?.[1] ?? 'Meal');
      break;
    }
    case 'drink': {
      t = t.replace(/^(drank|drink|drinking|had|have|chugged|downed|finished|got|grabbed|ordered|picked up|sipped)\s+/i, '');
      t = t.replace(RE.volume, ' ').replace(RE.countDrink, (_m, _n, what: string) => ` ${what.replace(/s$/i, '')} `);
      t = t.replace(/\b(\d+(\.\d+)?|a|an|one|two|three|four|five)?\s*(bottles?|glass(es)?|cups?|cans?|mugs?|shots?)\s+of\s+/gi, ' ');
      t = t.replace(/^\s*of\s+/i, '');
      t = stripArticle(t.replace(/\s{2,}/g, ' ').trim());
      if (!t || /^\d/.test(t)) t = e.kind ?? 'Drink';
      break;
    }
    case 'workout': {
      if (e.lifts?.length) {
        const names = [...new Set(e.lifts.map((l) => l.name))];
        t = names.join(' + ');
        break;
      }
      if (/\b(ran|run|running|jog|jogged|jogging)\b/i.test(t)) t = 'Run';
      else if (/\b(swam|swim|swimming)\b/i.test(t)) t = 'Swim';
      else if (/\b(biked|bike|cycling|rode)\b/i.test(t)) t = 'Bike ride';
      else {
        t = t.replace(/^(did|hit|went on|went to|went|worked out at|worked out|trained at|trained|lifted at|lifted|at)\s+/i, '');
        t = t.replace(/^(the|a|an|my)\s+/i, '');
        t = t.replace(/\s*\d+(\.\d+)?\s*(mi|miles?)\b/gi, '').trim();
        if (!t) t = 'Workout';
      }
      break;
    }
    case 'money': {
      t = t.replace(RE.moneyAll, ' ').replace(/\s{2,}/g, ' ').trim();
      t = t.replace(/^(spent|spend|paid me back|paid me|paid|pay|bought|buy|made|make|earned|got paid|got|sold|received|lost|won|picked up|sent me|gave me|had|ate|grabbed)(\s+|$)/i, '');
      t = t.replace(/\s+(it was|was|it cost|cost|costs|for)\s*$/i, '');
      t = t.replace(/^\s*(on|for|from|at|with|in|off|of)\s+/i, '');
      t = t.replace(/\s+(on|for|from|at|with|in)\s*$/i, '');
      t = stripArticle(t.replace(/\s{2,}/g, ' ').trim());
      if (!t) t = (e.money ?? 0) >= 0 ? 'Income' : 'Expense';
      break;
    }
    case 'sleep':
      return /\bnap/i.test(chunk) ? 'Nap' : 'Sleep';
    case 'mood': {
      t = t.replace(/^(felt|feel|feeling|was|am|been|i'm|im)\s+/i, '');
      t = t.replace(/^(pretty|really|so|very|super|kinda|kind of|a bit|a little)\s+/i, '');
      break;
    }
    case 'business':
    case 'social': {
      t = t.replace(/^(had|did|went on|went to|went|got)\s+(a|an|my)?\s*/i, '');
      t = t.replace(/^spent\s+(time\s+)?(on\s+|at\s+)?(the\s+|my\s+)?/i, '');
      break;
    }
    default:
      break;
  }
  return cap(t.replace(/\s{2,}/g, ' ').trim()) || cap(chunk.trim());
}

/** The amount of money in a message: "$1,250" -> 1250, "$5k" / "2 grand" -> 5000 / 2000, "40 bucks" -> 40. */
export function moneyAmount(s: string): number | undefined {
  const m = s.match(/\$\s?(\d[\d,]*(?:\.\d+)?)(\s?k\b)?|\b(\d[\d,]*(?:\.\d+)?)\s?(bucks|dollars|usd|grand)\b/i);
  if (!m) return undefined;
  const n = parseFloat((m[1] ?? m[3]).replace(/,/g, ''));
  if (!Number.isFinite(n)) return undefined;
  return m[2] || m[4]?.toLowerCase() === 'grand' ? n * 1000 : n;
}

function isIncome(s: string): boolean {
  if (RE.moneyInStrong.test(s)) return true;
  if (RE.moneyOut.test(s)) return false;
  return RE.moneyInWeak.test(s);
}

function isMoney(s: string): boolean {
  if (moneyAmount(s) === undefined) return false;
  if (RE.moneyInStrong.test(s) || RE.moneyOut.test(s) || RE.moneyInWeak.test(s)) return true;
  // "coffee $6", "starbucks latte $7.25": a price with no verb is spending (but "$20 an hour" is a rate)
  return /\$\s?\d|\d\s?(bucks|dollars)\b/i.test(s) && !RE.moneyRate.test(s);
}

/** Take out phrases that fool the keyword rules: "after the gym", "ran errands", "drove 50 miles", "watched football". */
function forClassify(s: string): string {
  let c = ` ${s} `;
  c = c.replace(/\b(after|before|post|pre)[- ]?(the |my |a |our )?(gym|workout|work out|lift|lifting|run|practice|training|game|session)\b/gi, ' ');
  c = c.replace(/\b(ran|run|running|runs)\s+(errands?|to|into|out|late|over|across|through|around town|a (meeting|business|company|errand))\b/gi, ' ');
  c = c.replace(/\b(french|cold|garlic|hand)\s+press(ed)?\b/gi, ' ');
  c = c.replace(/\bhad\s+(?:a|an|the|my|some)?\s*(?=(?:great|good|bad|rough|long|fun|nice|productive|busy|meeting|call|date|talk|conversation|day|time|night|blast|session|class|lesson|headache|dream)\b)/gi, ' ');
  if (/\b(drove|drive|driving|flew|flight|commuted?|road trip|uber|lyft)\b/i.test(c)) c = c.replace(/\b\d*\s*(mi|miles?)\b/gi, ' ');
  if (/\bwatch(ed|ing)?\b/i.test(c) && !/\bplay(ed|ing)?\b/i.test(c)) {
    c = c.replace(/\b(basketball|football|soccer|tennis|pickleball|volleyball|baseball|softball|hockey|wrestling|boxing|mma|ufc|golf|video|videos|youtube|reels?|content)\b/gi, ' ');
  }
  return c.replace(/\s{2,}/g, ' ').trim();
}

function classify(s0: string): Category {
  if (isMoney(s0)) return 'money';
  const s = forClassify(s0);
  if (RE.sleep.test(s)) return 'sleep';
  if (RE.workout.test(s)) return 'workout';
  if (/^\s*(legs|arms|chest|back|shoulders|abs|core|glutes|bis|tris|delts|push|pull|upper body|lower body)\b/i.test(s) && minutesIn(s)) return 'workout';
  if (RE.service.test(s) || RE.personal.test(s)) return 'activity';
  if (RE.social.test(s)) return 'social';
  if (RE.business.test(s)) return 'business';
  if (RE.drink.test(s) && !/\b(ate|breakfast|lunch|dinner)\b/i.test(s)) return 'drink';
  if (RE.food.test(s)) return 'food';
  if (RE.mood.test(s)) return 'mood';
  if (RE.activity.test(s) || minutesIn(s)) return 'activity';
  // a short phrase that names a known food ("chipotle bowl", "quest bar") is food
  if (s.split(/\s+/).length <= 5 && !/\d{2,}/.test(s) && !/\b(watch(ed|ing)?|went|go|going|played|drove|called|texted|need|want|should|remember)\b/i.test(s) && isCuratedFood(s)) return 'food';
  return 'note';
}

/** Just a length of time: "took about an hour and 15 minutes", "1 hr at the gym", "90 min total". */
function isDurationOnly(s: string): boolean {
  if (!minutesIn(s)) return false;
  const rest = stripCommon(s).replace(/\b(took|takes|took me|it|was|were|about|around|like|roughly|total|in total|overall|there|in the gym|at the gym|the gym|gym|the whole thing|whole thing|whole|workout|session|lasted|spent|me|us|we|i|for|of|an?|and|half|hours?|hrs?|mins?|minutes?|altogether)\b/gi, ' ');
  return !rest.replace(/[\s,.]+/g, '');
}

export function quickParse(message: string, now: Date = new Date()): Entry[] {
  const today = toDay(now);
  const yesterday = addDays(today, -1);
  // when one thing gets split in two, both halves keep "last night" / "yesterday"
  const keepWhen = (parts: string[], whole: string) => {
    const when = whole.match(/\b(yesterday|last night)\b/i)?.[1];
    return when ? parts.map((p) => (new RegExp(`\\b${when}\\b`, 'i').test(p) ? p : `${p} ${when}`)) : parts;
  };
  const chunks = message
    // commas split things, but not the one in "$1,250"
    .split(/\n|;|,(?!\d{3}\b)|\.\s+|\bthen\b/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 1)
    // "went to bed at 11:30, woke up at 7" is one sleep
    .reduce<string[]>((acc, c) => {
      const prev = acc[acc.length - 1];
      if (prev && /\b(bed|asleep|slept)\b/i.test(prev) && !/\b(woke|wake)\b/i.test(prev) && /^\s*(and\s+)?(woke|wake|got up)\b/i.test(c)) acc[acc.length - 1] = `${prev} and ${c}`;
      else acc.push(c);
      return acc;
    }, [])
    // "32 oz of water and a coffee" -> two drinks
    // "volunteered 2 hours and read for an hour" -> two things, each with its own time
    .flatMap((c) => {
      const halves = c.split(/\s+and\s+(?!a half)/i);
      // but "an hour and 15 minutes" is one length of time
      if (halves.length === 2 && halves.every((h) => minutesIn(h)) && !/^\s*(?:about |like |around )?\d+\s*(?:m|min|mins|minutes?)\s*$/i.test(halves[1])) return keepWhen(halves, c);
      return [c];
    })
    // "chipotle $14", "had a burrito it was $12" -> the food, and the money
    .flatMap((c) => {
      if (!isMoney(c) || RE.moneyInStrong.test(c) || RE.moneyOut.test(c) || RE.moneyInWeak.test(c)) return [c];
      const food = c.replace(RE.moneyAll, ' ').replace(/\s+(it was|was|it cost|for|at)\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
      const cat = food ? classify(food) : 'note';
      return cat === 'food' || cat === 'drink' ? keepWhen([food, c], c) : [c];
    })
    // "took my girlfriend on a date spent $80 on dinner" -> the date, and the money
    .flatMap((c) => {
      const m = c.match(/^(.{6,}?)\s+(?:and\s+)?((?:spent|paid|bought)\s+\$.*)$/i);
      if (m && !['note', 'money'].includes(classify(m[1]))) return keepWhen([m[1], m[2]], c);
      return [c];
    })
    // "2 beers and a white claw" -> two drinks; "oatmeal and coffee" -> a food and a drink
    .flatMap((c) => {
      if (!/\band\b/i.test(c) || isMoney(c)) return [c];
      const cat = classify(c);
      if (cat !== 'drink' && cat !== 'food') return [c];
      const parts = c.split(/\s+and\s+/i);
      if (parts.length < 2) return [c];
      const cats = parts.map((p) => (RE.drink.test(p) ? 'drink' : classify(p)));
      if (cats.every((x) => x === 'drink')) return keepWhen(parts, c);
      if (cats.every((x) => x === 'drink' || x === 'food') && cats.includes('drink') && cats.includes('food')) return keepWhen(parts, c);
      return [c];
    });

  const out: Entry[] = [];
  // one gym session said in pieces ("Push day. Bench 185 3x8. Then flies.") becomes one workout with bullet lines
  const sessions = new Map<Entry, { chunks: string[]; when?: string }>();
  const timeOfDay = (s: string) => s.match(/\b(this morning|in the morning|this afternoon|this evening|tonight|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i)?.[1]?.toLowerCase();
  let pendingTag: AwardArea | undefined;
  // "yesterday" carries on to the next things said; "last night" is just that one thing
  let saidYesterday = false;
  for (const raw of chunks) {
    if (/\b(today|this morning|this afternoon|this evening|tonight)\b/i.test(raw)) saidYesterday = false;
    if (/\byesterday\b/i.test(raw)) saidYesterday = true;
    const lastNight = /\blast night\b/i.test(raw);
    // "..., that goes towards personal development" tags the thing before it instead of becoming its own entry
    if (isTagOnly(raw)) {
      const area = explicitAward(raw);
      if (area) {
        const targets = tagCoversAll(raw) ? out.filter((x) => taggable(x.category)) : out.slice(-1);
        if (targets.length) targets.forEach((x) => (x.awardArea = area));
        else pendingTag = area;
      }
      continue;
    }
    const tag = explicitAward(raw) ?? pendingTag;
    pendingTag = undefined;
    const chunk = mentionsAward(raw) ? stripAwardTag(raw) || raw : raw;
    let category = classify(chunk);
    // keep adding to the workout session started just before this
    const last0 = out[out.length - 1];
    const session = last0 ? sessions.get(last0) : undefined;
    // "took about an hour", "1 hr at the gym": how long that session was
    if (session && last0 && !tag && isDurationOnly(chunk) && (saidYesterday || lastNight ? yesterday : today) === last0.date) {
      last0.minutes = minutesIn(chunk);
      last0.awardArea = last0.awardArea ?? 'fitness';
      continue;
    }
    if (session && last0 && !tag) {
      const when = timeOfDay(chunk);
      const sameTime = !when || when === session.when;
      const sameDay = (saidYesterday || lastNight ? yesterday : today) === last0.date;
      // "185 pounds", "3 sets of 8" after "Bench press." (but "1 hr at the gym" is the session's length, handled below)
      const justNumbers = /^\s*(?:for|at|x|with)?\s*\d/i.test(chunk) && !isExercise(chunk) && !minutesIn(chunk) && (category === 'note' || category === 'workout');
      if (sameTime && sameDay && (justNumbers || (category === 'workout' && isExercise(chunk)))) {
        session.chunks.push(chunk);
        const mins = minutesIn(chunk);
        if (mins && !justNumbers) {
          last0.minutes = (last0.minutes ?? 0) + mins;
          last0.awardArea = last0.awardArea ?? 'fitness';
        }
        const miles = chunk.match(/(\d+(?:\.\d+)?)\s*(?:mi|miles?)\b/i);
        if (miles && last0.amount === undefined) {
          last0.amount = parseFloat(miles[1]);
          last0.unit = 'miles';
        }
        continue;
      }
    }
    if (tag && !taggable(category)) category = 'activity';
    if (tag && category === 'note') category = 'activity';
    // sleep goes on the morning they woke up: "slept 6 hours last night" is today's sleep
    const isYesterday = category === 'sleep' ? saidYesterday && !lastNight : saidYesterday || lastNight;
    const date = isYesterday ? yesterday : today;
    const e: Entry = {
      id: uid(),
      createdAt: now.toISOString(),
      date,
      time: date === today ? toTime(now) : undefined,
      category,
      text: chunk.trim(),
      source: 'chat',
    };
    const minutes = minutesIn(chunk);
    if (minutes) e.minutes = minutes;

    if (category === 'money') {
      const amt = moneyAmount(chunk) ?? 0;
      e.money = isIncome(chunk) ? amt : -amt;
      if (/\b(orders?|sales?|sold|store|shirts?|hoodies?|unconquered)\b/i.test(chunk)) e.kind = 'business';
      if (/\b(trad(e|ed|ing)|mes|es|nq|mnq|funded account|prop firm|futures)\b/i.test(chunk)) e.kind = 'trading';
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
        e.amount = isWater ? Math.round(n * CONTAINER_OZ(c[2]) * 10) / 10 : n;
        e.unit = isWater ? 'oz' : 'drinks';
      }
      // "a gallon of water", "half a liter of water", "a glass of water"
      if (e.amount === undefined) {
        const one = chunk.match(/\b(a|an|one|half a|half an)\s+(gallon|liter|litre|bottle|glass|can|cup|mug)\b/i);
        if (one) {
          e.amount = /^half/i.test(one[1]) ? 0.5 : 1;
          e.unit = one[2].toLowerCase();
        }
      }
      e.kind = drinkKind(chunk);
    }
    if (category === 'mood') e.mood = moodScore(chunk);
    if (category === 'sleep') {
      // "went to bed at 11 and woke up at 6:30"
      const sc = chunk.replace(/\bmidnight\b/gi, '12am').replace(/\bnoon\b/gi, '12pm');
      const bed = sc.match(/\b(?:bed|slept|asleep|sleep)\b(?:(?!\b(?:woke|wake|up)\b)[^0-9])*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      const wake = sc.match(/\b(?:woke|wake|up)\b[^0-9]*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!e.minutes && bed && wake) {
        const toMin = (h: number, m: number, ap: string | undefined, isBed: boolean) => {
          let hh = h % 12;
          if (ap ? ap.toLowerCase() === 'pm' : isBed && h >= 7) hh += 12; // "bed at 11" means pm
          return hh * 60 + m;
        };
        const b = toMin(+bed[1], +(bed[2] ?? 0), bed[3], true);
        const w = toMin(+wake[1], +(wake[2] ?? 0), wake[3], false);
        const mins = (w - b + 1440) % 1440;
        if (mins >= 60 && mins <= 16 * 60) e.minutes = mins;
      }
      // "slept from 11pm to 7am", "slept 11-7"
      const span = !e.minutes ? chunk.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|until|til|till|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) : null;
      if (span) {
        let b = (+span[1] % 12) * 60 + +(span[2] ?? 0);
        if (span[3] ? span[3].toLowerCase() === 'pm' : +span[1] >= 7) b += 12 * 60;
        let w = (+span[4] % 12) * 60 + +(span[5] ?? 0);
        if (span[6]?.toLowerCase() === 'pm') w += 12 * 60;
        const mins = (w - b + 1440) % 1440;
        if (mins >= 60 && mins <= 16 * 60) e.minutes = mins;
      }
      // "slept 8", "slept like 6.5"
      const bare = !e.minutes ? chunk.match(/\bslept\s+(?:like\s+|about\s+|around\s+|only\s+)?(\d{1,2}(?:\.\d+)?)\b(?!\s*(?::|am|pm|to|until|-))/i) : null;
      if (bare && +bare[1] >= 1 && +bare[1] <= 14) e.minutes = Math.round(+bare[1] * 60);
      if (/\b(great|amazing|deep|solid|good|well|rested)\b/i.test(chunk)) e.mood = /\b(great|amazing|deep)\b/i.test(chunk) ? 5 : 4;
      else if (/\b(bad|rough|terrible|awful|crap|poorly|restless|barely|trash)\b/i.test(chunk)) e.mood = 2;
    }
    if (category === 'activity') {
      if (RE.service.test(chunk)) e.awardArea = e.minutes ? 'service' : undefined;
      else if (RE.personal.test(chunk)) e.awardArea = e.minutes ? 'personal' : undefined;
    }
    // what they said wins over the guess, even with no time given yet
    if (tag) e.awardArea = tag;
    e.text = itemText(category, chunk, e);
    // "slept great, 8 hours" / "6.5 hrs of sleep, slept like crap" -> one sleep entry
    const last = out[out.length - 1];
    const bareDuration = !!e.minutes && /^\s*(about |like |around )?[\d.]+\s*(h|hr|hrs|hours?|m|mins?|minutes?)\s*$/i.test(chunk);
    if (last && last.category === 'sleep' && last.date === e.date && (category === 'sleep' || bareDuration)) {
      last.minutes = last.minutes ?? e.minutes;
      last.mood = last.mood ?? e.mood;
      continue;
    }
    // "benched 225x5, 1 hr at the gym" -> one workout with a duration, not two entries
    const prev = out[out.length - 1];
    if (prev && prev.category === 'workout' && category === 'workout' && !e.lifts && e.minutes && !prev.minutes && prev.date === e.date && !isExercise(chunk)) {
      prev.minutes = e.minutes;
      prev.awardArea = prev.awardArea ?? e.awardArea ?? 'fitness';
      continue;
    }
    out.push(withEstimate(e, chunk));
    if (category === 'workout') sessions.set(e, { chunks: [chunk], when: timeOfDay(chunk) });
  }
  // a session said in more than one piece: title it, list each piece as a bullet, and read the lifts from every line
  for (const [e, s] of sessions) {
    const lines = bulletLines(s.chunks.join('\n')).filter((l) => !isSessionLength(l));
    if (s.chunks.length < 2 && lines.length < 2) continue;
    const session = sessionFromLines(lines, e.text);
    const lifts = liftsFromLines(lines);
    e.text = session.title;
    e.details = session.lines.length ? session.lines.join('\n') : undefined;
    e.lifts = lifts.length ? lifts : undefined;
  }
  return out;
}
