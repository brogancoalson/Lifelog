import type { Lift } from '../types';
import { type Group, groupsIn, muscleGroup } from './coach';

/**
 * Workouts written or dictated as free text: turn it into clean bullet lines, pull the
 * lift numbers out of each line for records, and name the session.
 * Pure functions, no React Native, so they're easy to test.
 */

export const LIFT_NAMES: [RegExp, string][] = [
  // specific names first so "leg curl" isn't a curl and "rdl" isn't a deadlift
  // "incline 60s 3x12" means incline bench; "incline curls" / "incline walk" don't
  [/\bincline\b(?!.*\b(?:curls?|fl(?:y|ys|ies|yes)|rows?|raises?|walk(?:ing)?|treadmill|sit[- ]?ups?|crunch(?:es)?)\b)/i, 'Incline bench press'],
  [/\brdls?\b|romanian/i, 'Romanian deadlift'],
  [/leg curl/i, 'Leg curl'],
  [/leg press/i, 'Leg press'],
  [/leg ext/i, 'Leg extension'],
  [/lat pull|pull ?downs?/i, 'Lat pulldown'],
  [/lat(?:eral)? raises?/i, 'Lateral raise'],
  [/shoulder press|military press/i, 'Shoulder press'],
  [/bench/i, 'Bench press'],
  [/squat/i, 'Squat'],
  [/deadlift|\bdl\b/i, 'Deadlift'],
  [/ohp|overhead press/i, 'Overhead press'],
  [/curl/i, 'Curl'],
  [/row/i, 'Row'],
  [/pull[- ]?up|chin[- ]?up/i, 'Pull-up'],
  [/push[- ]?up/i, 'Push-up'],
  [/dips/i, 'Dips'],
  [/lunges?/i, 'Lunge'],
  [/hip thrusts?/i, 'Hip thrust'],
  [/calf raises?/i, 'Calf raise'],
  [/shrugs?/i, 'Shrug'],
  [/triceps?|skull ?crushers?|push ?downs?/i, 'Triceps'],
  [/\bfl(?:y|ys|ies|yes)\b/i, 'Fly'],
];

// a weight somewhere else in the line: "with 60s", "at 185", "185 lbs"
function weightIn(rest: string): number | undefined {
  const cleaned = rest.replace(/\b\d+(?:\.\d+)?\s*(?:min|mins|minutes?|sec|secs|seconds?|mi|miles?|reps?|sets?|rounds?|laps?|x)\b/gi, ' ');
  const tagged = cleaned.match(/(?:\b(?:at|with)|@)\s*(\d{1,4}(?:\.\d+)?)\b|\b(\d{1,4}(?:\.\d+)?)\s*(?:lbs?|pounds?|s\b|kg)/i);
  const n = tagged ? +(tagged[1] ?? tagged[2]) : NaN;
  if (n >= 5 && n <= 1200) return n;
  const bare = cleaned.match(/\b(\d{2,4})\b/);
  return bare && +bare[1] >= 45 && +bare[1] <= 1200 ? +bare[1] : undefined;
}

/** The numbers in one exercise: "3x5 at 225", "225 for 5", "185 3 sets of 8", "50 push-ups". */
export function liftNumbers(part: string): Omit<Lift, 'name'> {
  // "3x5 at 225" / "3x5 @ 225"
  let m = part.match(/(\d+)\s*[x×]\s*(\d+)\s*(?:at|@)\s*(\d+)/i);
  if (m) return { sets: +m[1], reps: +m[2], weight: +m[3] };
  // "225 5x5" (weight, then sets x reps)
  m = part.match(/(\d{2,4})\s*(?:lbs?|pounds)?\s+(\d{1,2})\s*[x×]\s*(\d{1,2})\b/i);
  if (m) return { weight: +m[1], sets: +m[2], reps: +m[3] };
  // "225 for 5 sets of 5"
  m = part.match(/(\d{2,4})\s*(?:lbs?|pounds)?\s*(?:for|x)\s*(\d{1,2})\s*sets?\s*(?:of|x)\s*(\d{1,2})/i);
  if (m) return { weight: +m[1], sets: +m[2], reps: +m[3] };
  // "pull ups 3x10", "incline 3x12 with 60s" (small first number = sets)
  m = part.match(/\b(\d{1,2})\s*[x×]\s*(\d{1,2})\b(?!\s*(?:at|@))/i);
  if (m && +m[1] <= 10) {
    const weight = weightIn(part.replace(m[0], ' '));
    return weight !== undefined ? { sets: +m[1], reps: +m[2], weight } : { sets: +m[1], reps: +m[2] };
  }
  // "5 sets of 5 at 225"
  m = part.match(/(\d+)\s*sets?\s*of\s*(\d+)[^\d]*?(?:at|@|with)\s*(\d+)/i);
  if (m) return { sets: +m[1], reps: +m[2], weight: +m[3] };
  // "185 3 sets of 8", "3 sets of 12", "4 sets of 10 reps"
  m = part.match(/\b(\d{1,2})\s*sets?\s*(?:of|x)\s*(\d{1,3})\b/i);
  if (m) {
    const weight = weightIn(part.replace(m[0], ' '));
    return weight !== undefined ? { sets: +m[1], reps: +m[2], weight } : { sets: +m[1], reps: +m[2] };
  }
  // "225 for 5" / "225x5" / "225 x 5 x 3"
  m = part.match(/(\d{2,4})\s*(?:lbs?|pounds)?\s*(?:x|×|for)\s*(\d{1,2})(?:\s*(?:x|×|for)\s*(\d{1,2}))?/i);
  if (m) return { weight: +m[1], reps: +m[2], sets: m[3] ? +m[3] : undefined };
  // "50 push-ups"
  m = part.match(/(\d+)\s*(?:reps?\s*(?:of)?\s*)?(?:push[- ]?ups?|pull[- ]?ups?|chin[- ]?ups?|dips)/i);
  if (m) return { reps: +m[1] };
  // "10 reps", "3 sets"
  const reps = part.match(/\b(\d{1,3})\s*reps?\b/i);
  const sets = part.match(/\b(\d{1,2})\s*sets?\b/i);
  if (reps || sets) {
    const weight = weightIn(part.replace(reps?.[0] ?? '', ' ').replace(sets?.[0] ?? '', ' '));
    const o: Omit<Lift, 'name'> = {};
    if (sets) o.sets = +sets[1];
    if (reps) o.reps = +reps[1];
    if (weight !== undefined) o.weight = weight;
    return o;
  }
  // "hit a PR on squat 365"
  m = part.match(/\b(\d{2,4})\s*(?:lbs?|pounds)?\b/i);
  if (m && +m[1] >= 45 && +m[1] <= 1200) return { weight: +m[1] };
  return {};
}

export function parseLifts(s: string): Lift[] {
  const lifts: Lift[] = [];
  // split on "and"/"then" so each lift gets its own numbers
  for (const part of s.split(/\band\b|\bthen\b|&|\+/i)) {
    const name = LIFT_NAMES.find(([re]) => re.test(part))?.[1];
    if (!name) continue;
    lifts.push({ name, ...liftNumbers(part) });
  }
  return lifts;
}

// ---------------------------------------------------------------------------
// Free text -> bullet lines

const WORDNUM =
  '(?:twenty[- ]five|forty[- ]five|thirty[- ]five|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)';
const WORD_VALUE: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  'twenty five': 25, thirty: 30, 'thirty five': 35, forty: 40, 'forty five': 45, fifty: 50, sixty: 60,
};
const toNum = (w: string) => String(WORD_VALUE[w.toLowerCase().replace('-', ' ')] ?? w);

/** "three sets of ten" -> "3 sets of 10", "3 by 10" -> "3x10" (how dictation writes numbers). */
export function digitize(s: string): string {
  return s
    .replace(new RegExp(`\\b${WORDNUM}\\b(?=\\s*(?:sets?|reps?|x\\b|by\\s+\\d|by\\s+${WORDNUM}|times\\b|pounds?|lbs?|plates?|minutes?|mins?|miles?|seconds?|secs?|rounds?|laps?)\\b)`, 'gi'), toNum)
    .replace(new RegExp(`\\b(sets? of|reps? of|for|x|by|times)\\s+(${WORDNUM})\\b(?!\\s+(?:point|time|more|last|of us|of them))`, 'gi'), (_m, a: string, w: string) => `${a} ${toNum(w)}`)
    .replace(/\b(\d{1,4})\s*(?:by|times)\s*(\d{1,3})\b/gi, '$1x$2');
}

// what an exercise is called, with the words that can come before it ("incline dumbbell press")
const MODIFIER =
  '(?:incline|decline|flat|seated|standing|lying|cable|rope|dumbbell|dumbbells|db|barbell|bb|ez[- ]?bar|trap[- ]?bar|machine|smith|hammer|preacher|reverse|close[- ]grip|wide[- ]grip|narrow[- ]grip|single[- ]arm|one[- ]arm|single[- ]leg|weighted|assisted|front|rear|side|lateral|upright|bent[- ]over|pendlay|t[- ]?bar|landmine|arnold|bulgarian|romanian|sumo|goblet|hack|nordic|glute|ab|russian|lat|leg|chest|shoulder|overhead|military|hip|calf|face|tricep|triceps|bicep|biceps|rear delt|hanging|split|walking|jump|jumping|straight[- ]arm|high|low|pec|deficit|pause|paused|box|floor|spider|concentration|zottman|cross[- ]body)';
const HEAD =
  '(?:bench(?: press)?|squats?|deadlifts?|rdls?|press(?:es)?|curls?|rows?|pull[- ]?ups?|chin[- ]?ups?|push[- ]?ups?|dips|lunges?|fl(?:y|ys|ies|yes)|raises?|extensions?|pull ?downs?|push ?downs?|thrusts?|shrugs?|kickbacks?|crunch(?:es)?|planks?|pullovers?|sit[- ]?ups?|incline|decline|skull ?crushers?|face pulls?|ohp|rdl)';
const EXERCISE_RE = new RegExp(`(?:\\b${MODIFIER}\\s+)*\\b${HEAD}\\b`, 'gi');
const CARDIO_RE = /\b(ran|run|running|jog|jogged|jogging|miles?|bike|biked|cycling|swim|swam|stair ?master|stairs|treadmill|elliptical|rower|rowing machine|walk|walked|sprints?|cardio|hike|hiked|warm[- ]?up|cool[- ]?down|stretch(?:ed|ing)?|abs|core)\b/i;

/** True when a phrase names an exercise or cardio ("squats", "cable flies", "ran 2 miles"). */
export function isExercise(s: string): boolean {
  EXERCISE_RE.lastIndex = 0;
  return EXERCISE_RE.test(s) || LIFT_NAMES.some(([re]) => re.test(s)) || CARDIO_RE.test(s);
}

// words after a comma that keep going with the same exercise ("..., felt heavy", "..., about an hour")
const CONTINUES =
  /^(?:which|that|but|so|with|at|for|of|to|on|in|each|per|about|around|like|maybe|probably|pretty|really|super|kinda|kind of|it|its|it's|this|these|those|they|felt|feeling|feels|was|were|is|lbs?|pounds?|reps?|sets?|all|both|last|first|then|until|till|plus|no|not|only|just|still|went up|going up|up to|down to|same|easy|hard|heavy|light|failure|to failure|drop ?sets?|super ?set(?:ted)?(?: with)?|paused?|slow|tempo|each side|each arm|each leg|per side|per arm|per leg)\b/i;

/** "Push day", "leg day", "chest and tris", "upper body" as the name of a session. */
const DAY_NAME =
  /^(?:(?:my|a|an|the|today\s*(?:was|is)?|today's|it was|did|hit|had)\s+)*((?:push|pull|legs?|chest|back|arms?|shoulders?|upper(?:[- ]body)?|lower(?:[- ]body)?|full[- ]body|cardio|core|abs?|glutes?|bis|tris|biceps|triceps|delts|back and bis|chest and tris|chest and triceps|back and biceps|shoulders and arms|arms and shoulders)(?:\s+(?:and|&|\+)\s+(?:bis|tris|biceps|triceps|shoulders|back|chest|arms|abs|core|legs|cardio))?(?:\s+(?:day|workout|session|lift|training))?)\s*(?:day|workout|session)?$/i;

// "today", "for 75 min" around a session name
const WHEN_WORDS = /\b(?:today|tonight|this morning|this afternoon|this evening|yesterday|(?:for\s+)?(?:about\s+|like\s+|around\s+)?(?:\d+(?:\.\d+)?|an?|one)\s*(?:h|hr|hrs|hours?|m|min|mins|minutes?)(?:\s+and a half)?)\b/gi;

export function dayName(line: string): string | undefined {
  const t = line.replace(WHEN_WORDS, ' ').replace(/\s{2,}/g, ' ').trim().replace(/[.!?:,]+$/, '').trim();
  const m = t.match(DAY_NAME);
  if (!m) return undefined;
  // "back" or "chest" alone is too thin to be a title unless it says day/workout/session
  const name = m[1];
  if (!/\b(day|workout|session|lift|training|body|and|&|\+)\b/i.test(t) && !/^(push|pull|legs|arms|cardio)$/i.test(name)) return undefined;
  return cap(name.replace(/\s+/g, ' '));
}

/** A first line that's just the muscles ("Shoulders", "did back") names the session too. */
function looseDayName(line: string): string | undefined {
  const named = dayName(line);
  if (named) return named;
  const t = line.replace(WHEN_WORDS, ' ').replace(/\s{2,}/g, ' ').trim().replace(/[.!?:,]+$/, '');
  const m = t.match(/^(?:(?:did|hit|trained|worked)\s+)?(chest|back|shoulders|legs|arms|abs|core|glutes|biceps|triceps|bis|tris)$/i);
  return m ? cap(m[1].toLowerCase()) : undefined;
}

const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function cleanLine(s: string): string {
  let t = s
    .trim()
    .replace(/^[•●▪◦‣*–—-]+\s*/, '')
    // "um", "uh" anywhere
    .replace(/(?:,\s*)?\b(?:um+|uh+|erm)\b,?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s.!?,;:]+$/, '')
    .trim();
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/^(?:and|so|also|plus|then|next|after that|afterwards|ok|okay|alright|first off|lastly|finally|first(?=,|\s+(?:i|we|up|off)\b))\b[,:]?\s*/i, '')
      .replace(/^(?:i|we)\s+(?:also\s+|then\s+|just\s+|finally\s+)?(?=\w)/i, '')
      .replace(/^(?:did|started with|started off with|finished with|finished off with|finished up with|ended with|ended on|went into|moved on to|moved to)\s+(?=\w)/i, '')
      .replace(/^(?:some|a few|a couple(?: of)?|a little|a bit of)\s+(?=[a-z])/i, '');
  }
  return cap(t.replace(/\s{2,}/g, ' ').trim());
}

const FILLER_LINE = /^(?:um+|uh+|ok(?:ay)?|so|and|yeah|yep|that's it|that's all|thats it|done|the end|workout|gym)$/i;

// "bench 185 3x8 incline 60s 3x12 cable flies 3x15" -> one exercise per piece
function splitRunOn(line: string): string[] {
  if (!/^[a-z]/i.test(line.trim())) return [line];
  EXERCISE_RE.lastIndex = 0;
  const hits = [...line.matchAll(EXERCISE_RE)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  if (hits.length < 2) return [line];
  const cuts: number[] = [];
  for (let i = 1; i < hits.length; i++) {
    const between = line.slice(hits[i - 1].end, hits[i].start);
    if (/\d/.test(between)) cuts.push(hits[i].start);
  }
  if (!cuts.length) return [line];
  const out: string[] = [];
  let from = 0;
  for (const c of cuts) {
    out.push(line.slice(from, c));
    from = c;
  }
  out.push(line.slice(from));
  return out.map((p) => p.replace(/[\s,]+(?:super ?set(?:ted)?\s+with|super ?set|with|and|then|into|plus|followed by)?[\s,]*$/i, '').trim()).filter(Boolean);
}

/**
 * Typed or dictated workout -> one short line per exercise or note.
 * "Push day. Bench 185 for 3 sets of 8, then incline 60s 3x12. Cable flies and push ups"
 * -> ["Push day", "Bench 185 for 3 sets of 8", "Incline 60s 3x12", "Cable flies", "Push ups"]
 */
export function bulletLines(text: string): string[] {
  const out: string[] = [];
  const src = digitize(text.replace(/\r/g, ''));
  for (const rawLine of src.split('\n')) {
    // drop bullets or numbering they already typed ("- ", "• ", "1. ", "2) ")
    const line = rawLine.replace(/^\s*(?:[•●▪◦‣*–—-]+|\d{1,2}[.)](?=\s))\s*/, '');
    const pieces = line
      // sentences ("...185. Then incline...") but not decimals ("2.5 miles")
      .replace(/([.!?])\s+/g, '$1\n')
      // "then", "after that", "followed by" start the next exercise
      .replace(/[,;]?\s*\b(?:and then|then|after that|afterwards|afterward|followed by|next up|moved on to)\b[,:]?\s*/gi, '\n')
      .replace(/;/g, '\n')
      .split('\n');
    for (let piece of pieces) {
      // "Push day: bench 185 3x8" / "push day bench 205x5" -> the title, then the lift
      const label = piece.match(/^\s*([^:]{2,40}):\s*(.+)$/);
      const named = piece.match(/^\s*(.{2,30}?\b(?:day|workout|session))\b[\s,-]+(.+)$/i);
      if (label && (dayName(label[1]) || (!/\d/.test(label[1]) && label[1].trim().split(/\s+/).length <= 3 && isExercise(label[2])))) {
        out.push(label[1]);
        piece = label[2];
      } else if (named && dayName(named[1]) && isExercise(named[2])) {
        out.push(named[1]);
        piece = named[2];
      }
      // commas: a new exercise starts unless the words keep describing the last one
      const commaParts: string[] = [];
      for (const p of piece.split(/\s*,\s*/)) {
        const q = p.replace(/^and\s+/i, '');
        const prev = commaParts[commaParts.length - 1];
        if (prev === undefined) commaParts.push(p);
        else if (/^[a-z]/i.test(q) && !CONTINUES.test(q) && (isExercise(q) || /\d/.test(q))) commaParts.push(q);
        else commaParts[commaParts.length - 1] = `${prev}, ${p}`;
      }
      for (const c of commaParts) {
        // "squats and lunges" -> two; "3 sets of 10 and 12" stays one
        const halves = c.split(/\s+(?:and|&|plus)\s+/i);
        const parts = halves.length > 1 && halves.every((h) => isExercise(h)) ? halves : [c];
        for (const p of parts) out.push(...splitRunOn(p));
      }
    }
  }
  const lines: string[] = [];
  for (const l of out.map(cleanLine)) {
    if (l.length <= 1 || FILLER_LINE.test(l)) continue;
    // "Bench press. 185 pounds. 3 sets of 8." -> the numbers go with the exercise before them
    const prev = lines[lines.length - 1];
    if (prev && /^(?:for|at|x|with)?\s*\d/i.test(l) && !isExercise(l) && !/\b(total|whole|overall|workout|session|gym)\b/i.test(l) && isExercise(prev)) {
      lines[lines.length - 1] = `${prev}, ${l.charAt(0).toLowerCase()}${l.slice(1)}`;
      continue;
    }
    lines.push(l);
  }
  return lines.map((l) => l.slice(0, 200)).slice(0, 40);
}

export const BULLET = '•';

/** Lines -> the text shown in the box: "• Bench 185 3x8\n• Squats 225 3x5". */
export function formatBullets(lines: string[]): string {
  return lines.map((l) => `${BULLET} ${l}`).join('\n');
}

/** Stored details ("line\nline") -> lines. */
export function detailLines(details?: string): string[] {
  return details ? details.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// Lines -> lifts and a title

const NOT_A_LIFT = /\b(ran|run|jog|walk|walked|bike|biked|swim|swam|miles?|minutes?|mins?|stair|treadmill|elliptical|cardio|felt|feel|warm|cool|stretch)\b/i;

/** Lift numbers for records, one per line that names a lift ("Face pulls 3x15" counts too). */
export function liftsFromLines(lines: string[]): Lift[] {
  const lifts: Lift[] = [];
  for (const line of lines) {
    const known = parseLifts(line);
    if (known.length) {
      lifts.push(...known);
      continue;
    }
    if (NOT_A_LIFT.test(line)) continue;
    const nums = liftNumbers(line);
    if (nums.sets === undefined && nums.reps === undefined) continue;
    // the name is the words before the numbers, or after "3 sets of 12"
    const lead = line.match(/^([a-z][a-z' -]{1,40}?)\s+(?=\d|for\b|at\b)/i)?.[1];
    const tail = line.match(/^\d.*?\b(?:sets?\s*of\s*\d+|\d+\s*x\s*\d+|reps?)\s+(?:of\s+)?([a-z][a-z' -]{1,40})$/i)?.[1];
    const name = (lead ?? tail ?? '').trim();
    if (!name || name.split(/\s+/).length > 4) continue;
    lifts.push({ name: cap(name.toLowerCase()), ...nums });
  }
  return lifts;
}

const GROUP_LABEL: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', legs: 'Legs', biceps: 'Biceps', triceps: 'Triceps', core: 'Abs', cardio: 'Cardio',
};
const DAY_OF: Record<string, string> = {
  chest: 'Chest day', back: 'Back day', shoulders: 'Shoulder day', legs: 'Leg day', biceps: 'Arm day', triceps: 'Arm day', core: 'Abs',
};
const CARDIO_LINE = /\b(ran|run|running|jog|jogged|jogging|miles?|bike|biked|biking|cycling|swim|swam|swimming|stair ?master|stairs|treadmill|elliptical|rower|rowing machine|walk|walked|walking|sprints?|hike|hiked|cardio)\b/i;

function lineGroups(line: string): Group[] {
  const lifts = parseLifts(line);
  if (CARDIO_LINE.test(line) && !lifts.length) return ['cardio'];
  // "squatted 315" -> the lift's name says which muscles
  const fromLifts = lifts.map((l) => muscleGroup(l.name)).filter((g) => g !== 'other');
  if (fromLifts.length) return [...new Set(fromLifts)];
  // a list ("chest, back and arms") counts every group; one exercise counts its main group
  if (/,|\band\b|&/.test(line) && !/\d/.test(line)) return groupsIn(line).filter((g) => g !== 'cardio');
  const g = muscleGroup(line);
  return g === 'other' ? [] : [g];
}

/**
 * The session's title and the lines to show under it. A line that just names the day ("Push day")
 * becomes the title; otherwise it's named from the muscle groups ("Chest + Triceps", "Leg day").
 */
export function sessionFromLines(lines: string[], fallback = 'Workout'): { title: string; lines: string[] } {
  const first = lines.length > 1 ? looseDayName(lines[0]) : undefined;
  if (first) return { title: first, lines: lines.slice(1) };
  const idx = lines.findIndex((l) => dayName(l));
  if (idx >= 0) return { title: dayName(lines[idx])!, lines: lines.filter((_, i) => i !== idx) };
  // two lifts read best by name ("Bench press + Squat"); more get named by muscle group
  if (lines.length <= 2) {
    const names = [...new Set(lines.flatMap((l) => parseLifts(l).map((x) => x.name)))];
    if (names.length && names.length <= 2 && lines.every((l) => parseLifts(l).length)) return { title: names.join(' + '), lines };
  }
  return { title: autoTitle(lines) ?? fallback, lines };
}

/** "Went to the gym for an hour": just how long the session was, already counted in minutes. */
export function isSessionLength(line: string): boolean {
  return /^(?:(?:went|been|was|were|hit|got)\s+(?:to\s+|at\s+|in\s+)?(?:the\s+)?gym|at the gym|in the gym|gym|worked out|work ?out|lifted|trained|session|total|the whole thing)(?:\s+(?:for|about|like|around|an?|one|half|hours?|hrs?|h|mins?|minutes?|m|and|a|total|today|tonight|this morning|this evening|\d+(?:\.\d+)?))*$/i.test(line.trim());
}

export function autoTitle(lines: string[]): string | undefined {
  const order: Group[] = [];
  for (const l of lines) for (const g of lineGroups(l)) if (!order.includes(g)) order.push(g);
  const lifting: Group[] = order.filter((g) => g !== 'cardio' && g !== 'other');
  const cardio = order.includes('cardio');
  if (!lifting.length) {
    if (!cardio) return undefined;
    return lines.every((l) => !CARDIO_LINE.test(l) || /\b(ran|run|running|jog|jogged|jogging)\b/i.test(l)) ? 'Run' : 'Cardio';
  }
  const has = (g: Group) => lifting.includes(g);
  const only = (...gs: Group[]) => lifting.every((g) => gs.includes(g));
  const upper = lifting.filter((g) => (['chest', 'back', 'shoulders', 'biceps', 'triceps'] as Group[]).includes(g));
  let title: string;
  if (lifting.length === 1) title = cardio ? GROUP_LABEL[lifting[0]] : DAY_OF[lifting[0]] ?? GROUP_LABEL[lifting[0]];
  else if (only('biceps', 'triceps')) title = 'Arm day';
  else if (only('chest', 'shoulders', 'triceps') && has('chest') && has('shoulders')) title = 'Push day';
  else if (has('legs') && upper.length >= 2) title = 'Full body';
  else if (upper.length >= 4 && !has('legs')) title = 'Upper body';
  else title = lifting.map((g) => GROUP_LABEL[g]).join(' + ');
  return cardio && lifting.length <= 2 ? `${title} + Cardio` : title;
}

/** One lift as a line that reads naturally and parses back the same: "Bench press 225 lbs 3x5". */
export function liftLine(l: Lift): string {
  const parts = [l.name];
  if (l.weight !== undefined && l.sets !== undefined && l.reps !== undefined) parts.push(`${l.weight} lbs ${l.sets}x${l.reps}`);
  else if (l.weight !== undefined && l.reps !== undefined) parts.push(`${l.weight} lbs x ${l.reps}`);
  else {
    if (l.weight !== undefined) parts.push(`${l.weight} lbs`);
    if (l.sets !== undefined && l.reps !== undefined) parts.push(`${l.sets}x${l.reps}`);
    else if (l.sets !== undefined) parts.push(`${l.sets} sets`);
    else if (l.reps !== undefined) parts.push(`${l.reps} reps`);
  }
  return parts.join(' ');
}

/** Short summary of one lift: "Bench press 225×5 (3 sets)". */
export function liftSummary(l: Lift): string {
  const nums = [l.weight, l.reps].filter((n) => n !== undefined).join('×');
  const sets = l.sets ? ` (${l.sets} sets)` : '';
  return nums ? `${l.name} ${nums}${sets}` : `${l.name}${sets}`;
}
