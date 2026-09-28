import type { AwardArea, Entry } from '../types';
import { AWARD_AREAS, AWARD_ORDER } from './categories';

/**
 * Spots when the user says where something counts for the Congressional Award:
 * "that goes towards personal", "counts for community service", "physical fitness hours",
 * "put it under service", "Personal development: read for an hour".
 */

const AREA = '(community service|public service|personal development|physical fitness|volunteer|service|personal|fitness|physical(?!\\s+(?:therapy|therapist|exam|education|ed)\\b)|expedition|exploration)';
const PREFIX = '(?:my\\s+|the\\s+|our\\s+)?(?:congressional\\s+|award\\s+|medal\\s+|gold\\s+|congressional award\\s+)*';
const SUFFIX = '(?:\\s+(?:hours?|development|category|area|section|time|side))?(?!\\s+(?:goals?|journey|trainer|training|record|best|reasons?|life|space|stuff|items?|belongings)\\b)';
const LEAD = '(?:(?:and|so|also)\\s+)?(?:that|this|it|which|those|these|both|all of (?:that|it|them)|all)?\\s*(?:should|will|can|would|is going to|gonna)?\\s*';

// "towards personal", "under service", "into fitness"
const DIRECTED = new RegExp(`\\b(?:towards?|under|into)\\s+${PREFIX}${AREA}${SUFFIX}\\b`, 'i');
// "counts for service", "goes to personal", "put it as fitness", "log it under personal"
const COUNTED = new RegExp(
  `\\b(?:counts?|counting|counted|put|putting|log|logging|add|adding|apply|applies|credit|file|mark)\\b(?:\\s+(?:it|this|that|them|those|these|toward|towards|for))?\\s+(?:for|as|to|towards?|under|in|into)\\s+${PREFIX}${AREA}${SUFFIX}\\b`,
  'i',
);
// "that goes to personal development" (but not "went to service")
const GOES_TO = new RegExp(`\\b(?:goes|go)\\s+to\\s+(?:my\\s+)?(?:congressional\\s+|award\\s+)*(personal development|personal|physical fitness|fitness|expedition|community service|service hours)\\b`, 'i');
// phrases that only ever mean an award area
const STRONG = /\b(community service|public service|personal development|physical fitness|service hours?|volunteer hours?|personal hours?|fitness hours?|expedition (?:hours?|prep|training|planning))\b/i;
// "Personal: read for an hour"
const LABEL = /^\s*(community service|personal development|physical fitness|service|personal|fitness|expedition)\s*[:\-–]\s*/i;
const MENTION = /\b(congressional|award hours?|for (?:my|the) (?:award|medal)|toward (?:my|the) (?:award|medal)|towards (?:my|the) (?:award|medal))\b/i;

function toArea(word: string): AwardArea {
  const w = word.toLowerCase();
  if (/service|volunteer/.test(w)) return 'service';
  if (/personal/.test(w)) return 'personal';
  if (/fitness|physical/.test(w)) return 'fitness';
  return 'expedition';
}

/** The area they named in this text, if any. */
export function explicitAward(text: string): AwardArea | undefined {
  const m = text.match(LABEL) ?? text.match(COUNTED) ?? text.match(GOES_TO) ?? text.match(DIRECTED) ?? text.match(STRONG);
  return m ? toArea(m[1]) : undefined;
}

/** Every distinct area named anywhere in a message. */
export function awardAreasIn(text: string): AwardArea[] {
  const found = new Set<AwardArea>();
  for (const part of text.split(/[,;.\n]|\bthen\b|\band\b/i)) {
    const a = explicitAward(part);
    if (a) found.add(a);
  }
  return [...found];
}

/** They mentioned the award but didn't say which area. */
export function mentionsAward(text: string): boolean {
  return MENTION.test(text) || !!explicitAward(text);
}

const TAG_CLAUSE = new RegExp(
  `[,;]?\\s*${LEAD}(?:\\b(?:counts?|counting|counted|put|putting|log|logging|add|adding|apply|applies|credit|file|mark)\\b(?:\\s+(?:it|this|that|them|those|these|toward|towards|for))?\\s+(?:for|as|to|towards?|under|in|into)|\\b(?:(?:goes|go|going|went)\\s+)?(?:towards?|under|into))\\s+${PREFIX}${AREA}${SUFFIX}\\b`,
  'gi',
);
const AWARD_CLAUSE = /[,;]?\s*(?:(?:and|so)\s+)?(?:that|this|it)?\s*(?:counts?|goes|is)?\s*(?:for|towards?|toward)\s+(?:my|the)\s+(?:congressional\s+)?(?:award|medal)(?:\s+hours?)?\b/gi;

/** The text with the "counts toward ..." part taken out, so the entry is just the thing itself. */
export function stripAwardTag(text: string): string {
  return text
    .replace(LABEL, '')
    .replace(TAG_CLAUSE, ' ')
    .replace(new RegExp(`[,;]?\\s*${LEAD}\\b(?:goes|go|going)\\s+to\\s+(?:my\\s+)?(?:congressional\\s+|award\\s+)*(?:personal development|personal|physical fitness|fitness|expedition|community service|service hours)${SUFFIX}\\b`, 'gi'), ' ')
    .replace(AWARD_CLAUSE, ' ')
    // "cleaned up the park for community service" -> "cleaned up the park"
    .replace(/[,;]?\s+(?:for|as)\s+(?:my\s+)?(?:community service|public service|personal development|physical fitness)(?:\s+hours?)?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const FILLER = new Set(
  'that this it which those these both all of should will can would is going to gonna goes go went count counts counting counted put putting log logging add adding apply applies credit file mark are was be towards toward for under as in into my the our congressional award medal gold hours hour development category area section time stuff side community public service personal physical fitness expedition exploration volunteer also and so please yeah um uh'.split(
    ' ',
  ),
);

/** True when a chunk is only a tag ("that goes towards personal development") with nothing to log itself. */
export function isTagOnly(chunk: string): boolean {
  if (!mentionsAward(chunk)) return false;
  const words = chunk.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  return words.every((w) => FILLER.has(w));
}

/** "both/all of those count toward service" applies to everything before it in the message. */
export function tagCoversAll(chunk: string): boolean {
  return /\b(both|all|those|these|them|everything)\b/i.test(chunk);
}

/** Entries that can count toward an award area (not food, drinks, money, sleep, or mood). */
export function taggable(category: string): boolean {
  return !['food', 'drink', 'money', 'sleep', 'mood'].includes(category);
}

const hrs = (m: number) => {
  const h = Math.round((m / 60) * 10) / 10;
  return `${h % 1 ? h.toFixed(1) : h} hr${h === 1 ? '' : 's'}`;
};

/** The award part of the chat reply: what got counted, what still needs a time, or which area to pick. */
export function awardReply(message: string, entries: Entry[]): string {
  const tagged = entries.filter((e) => e.awardArea);
  if (!tagged.length) {
    return mentionsAward(message) ? ' Which Congressional Award area is it for? Tap it and pick one, or say “goes toward personal”.' : '';
  }
  const counted = AWARD_ORDER.map((a) => {
    const mins = tagged.filter((e) => e.awardArea === a).reduce((sum, e) => sum + (e.minutes ?? 0), 0);
    return mins ? `+${hrs(mins)} ${AWARD_AREAS[a].short}` : '';
  }).filter(Boolean);
  let out = counted.length ? ` Congressional Award: ${counted.join(', ')}.` : '';
  const noTime = tagged.filter((e) => !e.minutes);
  if (noTime.length) {
    const names = noTime.map((e) => `“${e.text}”`).join(' and ');
    const areas = [...new Set(noTime.map((e) => AWARD_AREAS[e.awardArea!].short))].join('/');
    out += ` ${names} ${noTime.length > 1 ? 'go' : 'goes'} toward ${areas}, but I need how long it took. Tap it to add the time.`;
  }
  return out;
}
