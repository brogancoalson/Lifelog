const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTime(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function isValidDay(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function prettyDay(day: string, today: string = toDay()): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  if (day === addDays(today, 1)) return 'Tomorrow';
  const d = parseDay(day);
  const base = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === parseDay(today).getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

export function prettyTime(time?: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)}${ampm}`;
}

/** Monday-start week containing `day`. */
export function weekStart(day: string): string {
  const d = parseDay(day);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toDay(d);
}

export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function monthsBetween(from: string, to: string): number {
  const a = parseDay(from);
  const b = parseDay(to);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Days said in words: "Saturday", "last Friday", "2 days ago", "Oct 5th", "10/5", "the 5th" ----

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUM_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// what can come right after "3/4" when it's an amount, not a date
const AMOUNT_AFTER = /^\s*(?:of\b|a\b|an\b|the\b|cups?\b|c\b|oz\b|ounces?\b|lbs?\b|pounds?\b|tbsp\b|tsp\b|miles?\b|mi\b|gallons?\b|liters?\b|scoops?\b|slices?\b|pieces?\b|servings?\b|plates?\b|bowls?\b|bottles?\b|cans?\b|hours?\b|hrs?\b|done\b|reps?\b|sets?\b)/i;

const PATTERNS: { re: RegExp; kind: 'ago' | 'dby' | 'weekday' | 'monthday' | 'numeric' | 'ordinal' }[] = [
  { re: /\b(?:on\s+)?(?:the\s+)?day before yesterday\b/i, kind: 'dby' },
  { re: /\b(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|weeks?)\s+ago\b/i, kind: 'ago' },
  { re: new RegExp(`\\b(?:on\\s+)?(?:(last|this past|past|this)\\s+)?(${WEEKDAY_NAMES.join('|')})\\b(?!s)`, 'i'), kind: 'weekday' },
  { re: new RegExp(`\\b(?:on\\s+)?(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:x|min|mins|minutes?|hours?|hrs?|reps?|sets?|lbs?|pounds?|miles?|mi)\\b)(?:,?\\s*(\\d{4})\\b)?`, 'i'), kind: 'monthday' },
  { re: /(?:\bon\s+)?\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/i, kind: 'numeric' },
  { re: /\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b(?!\s+(?:sets?|reps?|rounds?|times?|miles?|laps?|place|grade|floor|set|exercise|lift|station)\b)/i, kind: 'ordinal' },
];

function validDay(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? toDay(dt) : undefined;
}

/** Find a day said in words. Returns the day and the exact words used, or nothing. */
export function findSaidDay(text: string, today: string = toDay()): { day: string; words: string } | undefined {
  const now = parseDay(today);
  const year = now.getFullYear();
  for (const { re, kind } of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const before = text.slice(0, m.index ?? 0);
    let day: string | undefined;
    if (kind === 'dby') day = addDays(today, -2);
    else if (kind === 'ago') {
      const n = NUM_WORDS[m[1].toLowerCase()] ?? parseInt(m[1], 10);
      day = addDays(today, -n * (/^w/i.test(m[2]) ? 7 : 1));
    } else if (kind === 'weekday') {
      if (/\bnext\s+$/i.test(before)) continue; // "next Monday" isn't a past day
      const target = WEEKDAY_NAMES.indexOf(m[2].toLowerCase());
      let back = (now.getDay() - target + 7) % 7;
      if (back === 0 && m[1] && !/^this$/i.test(m[1])) back = 7; // "last Monday" said on a Monday
      day = addDays(today, -back);
    } else if (kind === 'monthday') {
      const mon = MONTH_KEYS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1;
      const y = m[3] ? parseInt(m[3], 10) : year;
      day = validDay(y, mon, parseInt(m[2], 10));
      if (day && !m[3] && day > today) day = validDay(y - 1, mon, parseInt(m[2], 10));
    } else if (kind === 'numeric') {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const after = text.slice((m.index ?? 0) + m[0].length);
      const saidOn = /^\s*on\b/i.test(m[0]);
      // "3/4 cup", "1/2 a sandwich", "5/10 reps" are amounts
      if (!m[3] && AMOUNT_AFTER.test(after)) continue;
      if (!m[3] && !saidOn && a < b && [2, 3, 4, 8].includes(b)) continue;
      if (/\d\s*$/.test(before)) continue;
      const y = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : year;
      day = validDay(y, a, b);
      if (day && !m[3] && day > today) day = validDay(y - 1, a, b);
    } else if (kind === 'ordinal') {
      const d = parseInt(m[1], 10);
      day = validDay(year, now.getMonth() + 1, d);
      if (!day || day > today) {
        const prev = new Date(year, now.getMonth() - 1, 1);
        day = validDay(prev.getFullYear(), prev.getMonth() + 1, d);
      }
    }
    if (day) return { day, words: m[0] };
  }
  return undefined;
}

/** Take the day words out of a sentence: "Saturday did legs" -> "did legs". */
export function stripSaidDay(text: string, today: string = toDay()): string {
  let s = text;
  for (let i = 0; i < 3; i++) {
    const f = findSaidDay(s, today);
    if (!f) break;
    s = s.replace(f.words, ' ');
  }
  return s.replace(/^[\s,:\-–—]+|[\s,:\-–—]+$/g, '').replace(/\s{2,}/g, ' ');
}
