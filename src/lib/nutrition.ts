/**
 * Offline nutrition estimates for common foods and drinks.
 * Values are typical averages (USDA-style) for a normal restaurant or home portion.
 * They are estimates, marked as such in the app, and are only used when the
 * person didn't give their own numbers.
 */

import { estimateFromDb, tokenize } from './foodDb';

export interface Nutrition {
  calories: number;
  protein: number; // g
  carbs: number; // g
}

interface Food {
  /** words that identify it (matched as whole words, longest names first) */
  names: string[];
  /** nutrition for one unit */
  per: Nutrition;
  /** how many units a plain mention means ("eggs" = 2 eggs, "pizza" = 2 slices) */
  def: number;
  /** a composite dish: when it matches, the rest of that part isn't matched again */
  dish?: boolean;
  /** per-ounce values for meats, used when a weight is given ("8 oz steak") */
  perOz?: Nutrition;
  /** default ounces when no weight is given */
  defOz?: number;
}

const n = (calories: number, protein: number, carbs: number): Nutrition => ({ calories, protein, carbs });

// Order matters: more specific names first.
const FOODS: Food[] = [
  // --- dishes (one match per part) ---
  // common gym / snack brands (per item)
  { names: ['oreos', 'oreo cookies', 'oreo'], per: n(53, 0.5, 8.3), def: 3, dish: true },
  { names: ['quest bar', 'quest protein bar'], per: n(190, 21, 22), def: 1, dish: true },
  { names: ['built bar'], per: n(130, 17, 16), def: 1, dish: true },
  { names: ['one bar'], per: n(220, 20, 23), def: 1, dish: true },
  { names: ['rxbar', 'rx bar'], per: n(210, 12, 23), def: 1, dish: true },
  { names: ['kind bar'], per: n(200, 6, 16), def: 1, dish: true },
  { names: ['clif bar', 'cliff bar'], per: n(250, 10, 44), def: 1, dish: true },
  { names: ['fairlife', 'fair life', 'core power'], per: n(150, 30, 4), def: 1, dish: true },
  { names: ['premier protein', 'premier shake'], per: n(160, 30, 5), def: 1, dish: true },
  { names: ['muscle milk'], per: n(160, 25, 9), def: 1, dish: true },
  { names: ['ghost energy', 'bang energy', 'c4 energy', 'alani nu', 'celsius', 'zero sugar monster', 'monster zero'], per: n(10, 0, 2), def: 1, dish: true },
  { names: ['burrito bowl', 'chipotle bowl', 'poke bowl', 'rice bowl', 'chipotle', 'bowl'], per: n(700, 40, 75), def: 1, dish: true },
  { names: ['breakfast burrito'], per: n(600, 28, 50), def: 1, dish: true },
  { names: ['burrito'], per: n(800, 40, 90), def: 1, dish: true },
  { names: ['quesadilla'], per: n(700, 35, 50), def: 1, dish: true },
  { names: ['chick fil a', 'chick-fil-a', 'chickfila', 'chicken sandwich'], per: n(550, 30, 50), def: 1, dish: true },
  { names: ['pb&j', 'pbj', 'peanut butter and jelly', 'peanut butter sandwich'], per: n(380, 12, 45), def: 1, dish: true },
  { names: ['footlong'], per: n(700, 44, 90), def: 1, dish: true },
  { names: ['sandwich', 'sub', 'hoagie', 'panini', 'wrap'], per: n(450, 25, 50), def: 1, dish: true },
  { names: ['hot dog', 'hotdog'], per: n(290, 11, 24), def: 1, dish: true },
  { names: ['cheeseburger', 'burger', 'hamburger', 'smashburger'], per: n(0, 0, 0), def: 1, dish: true }, // built below
  { names: ['pizza'], per: n(285, 12, 36), def: 2, dish: true },
  { names: ['tacos', 'taco'], per: n(170, 9, 13), def: 3, dish: true },
  { names: ['nachos'], per: n(800, 25, 80), def: 1, dish: true },
  { names: ['mac and cheese', 'mac n cheese', 'mac & cheese', 'macaroni'], per: n(350, 13, 45), def: 1, dish: true },
  { names: ['spaghetti', 'lasagna', 'fettuccine', 'alfredo'], per: n(600, 25, 75), def: 1, dish: true },
  { names: ['ramen', 'pho'], per: n(450, 15, 60), def: 1, dish: true },
  { names: ['sushi', 'sushi roll'], per: n(300, 12, 45), def: 1, dish: true },
  { names: ['stir fry', 'fried rice', 'orange chicken', 'lo mein', 'pad thai'], per: n(650, 25, 80), def: 1, dish: true },
  { names: ['chicken nuggets', 'nuggets', 'chicken tenders', 'tenders', 'chicken strips'], per: n(45, 2.4, 2.6), def: 10, dish: true },
  { names: ['wings', 'chicken wings', 'wing'], per: n(85, 7, 1), def: 6, dish: true },
  { names: ['fried chicken'], per: n(300, 22, 10), def: 2, dish: true },
  { names: ['biscuits and gravy'], per: n(600, 12, 55), def: 1, dish: true },
  { names: ['pancakes', 'pancake'], per: n(120, 3, 20), def: 3, dish: true },
  { names: ['waffles', 'waffle'], per: n(200, 5, 25), def: 2, dish: true },
  { names: ['french toast'], per: n(150, 5, 18), def: 3, dish: true },
  { names: ['cereal'], per: n(300, 10, 55), def: 1, dish: true },
  { names: ['oatmeal', 'oats', 'overnight oats'], per: n(160, 6, 28), def: 1, dish: true },
  { names: ['soup', 'chili'], per: n(300, 15, 30), def: 1, dish: true },

  // --- proteins ---
  { names: ['beef jerky', 'jerky'], per: n(115, 15, 5), def: 1 },
  { names: ['egg whites', 'egg white'], per: n(126, 26, 2), def: 1 },
  { names: ['eggs', 'egg', 'omelette', 'omelet', 'scrambled eggs'], per: n(72, 6, 0.4), def: 2 },
  { names: ['steak', 'sirloin', 'ribeye', 'filet'], per: n(0, 0, 0), def: 1, perOz: n(65, 8, 0), defOz: 8 },
  { names: ['ground beef', 'beef'], per: n(0, 0, 0), def: 1, perOz: n(77, 7.3, 0), defOz: 4 },
  { names: ['chicken breast', 'chicken thigh', 'grilled chicken', 'chicken'], per: n(0, 0, 0), def: 1, perOz: n(47, 8.8, 0), defOz: 6 },
  { names: ['turkey'], per: n(0, 0, 0), def: 1, perOz: n(40, 7, 0.5), defOz: 4 },
  { names: ['salmon'], per: n(0, 0, 0), def: 1, perOz: n(58, 6.3, 0), defOz: 6 },
  { names: ['tuna'], per: n(0, 0, 0), def: 1, perOz: n(30, 6.5, 0), defOz: 5 },
  { names: ['shrimp'], per: n(0, 0, 0), def: 1, perOz: n(30, 6, 0.3), defOz: 4 },
  { names: ['fish', 'tilapia', 'cod'], per: n(0, 0, 0), def: 1, perOz: n(37, 7.3, 0), defOz: 6 },
  { names: ['pork chop', 'pork'], per: n(0, 0, 0), def: 1, perOz: n(55, 7.3, 0), defOz: 6 },
  { names: ['ham'], per: n(0, 0, 0), def: 1, perOz: n(46, 6, 0.7), defOz: 3 },
  { names: ['bacon'], per: n(43, 3, 0), def: 3 },
  { names: ['sausage', 'sausages', 'links'], per: n(90, 4, 0.5), def: 2 },
  { names: ['tofu'], per: n(180, 20, 4), def: 1 },
  { names: ['beans', 'black beans', 'refried beans'], per: n(230, 15, 40), def: 1 },

  // --- carbs and sides ---
  { names: ['french fries', 'fries', 'tater tots', 'hash browns'], per: n(380, 5, 48), def: 1 },
  { names: ['sweet potato'], per: n(110, 2, 26), def: 1 },
  { names: ['mashed potatoes', 'baked potato', 'potatoes', 'potato'], per: n(200, 4, 37), def: 1 },
  { names: ['brown rice', 'white rice', 'rice'], per: n(205, 4, 45), def: 1 },
  { names: ['pasta', 'noodles'], per: n(400, 14, 80), def: 1 },
  { names: ['bagel'], per: n(280, 11, 55), def: 1 },
  { names: ['toast', 'bread', 'slice of bread'], per: n(80, 3, 14), def: 2 },
  { names: ['english muffin', 'muffin'], per: n(350, 5, 50), def: 1 },
  { names: ['tortilla', 'tortillas'], per: n(140, 4, 24), def: 1 },
  { names: ['chips', 'tortilla chips'], per: n(150, 2, 16), def: 2 },
  { names: ['crackers'], per: n(130, 2, 20), def: 1 },
  { names: ['granola'], per: n(300, 7, 45), def: 1 },

  // --- dairy / snacks ---
  { names: ['greek yogurt'], per: n(130, 17, 8), def: 1 },
  { names: ['yogurt'], per: n(150, 6, 22), def: 1 },
  { names: ['cottage cheese'], per: n(180, 24, 10), def: 1 },
  { names: ['string cheese', 'cheese'], per: n(110, 7, 1), def: 1 },
  { names: ['protein bar'], per: n(200, 20, 22), def: 1 },
  { names: ['granola bar'], per: n(190, 3, 29), def: 1 },
  { names: ['peanut butter'], per: n(190, 7, 7), def: 1 },
  { names: ['almonds', 'nuts', 'cashews', 'peanuts', 'trail mix'], per: n(170, 6, 7), def: 1 },

  // --- fruit / veg ---
  { names: ['banana'], per: n(105, 1.3, 27), def: 1 },
  { names: ['apple'], per: n(95, 0.5, 25), def: 1 },
  { names: ['orange'], per: n(62, 1.2, 15), def: 1 },
  { names: ['berries', 'strawberries', 'blueberries', 'grapes'], per: n(70, 1, 17), def: 1 },
  { names: ['avocado', 'guacamole'], per: n(120, 1.5, 6), def: 1 },
  { names: ['salad'], per: n(150, 3, 10), def: 1 },
  { names: ['broccoli', 'vegetables', 'veggies', 'green beans', 'asparagus', 'spinach', 'corn', 'carrots'], per: n(55, 3, 11), def: 1 },

  // --- sweets ---
  { names: ['ice cream'], per: n(270, 5, 32), def: 1 },
  { names: ['cookies', 'cookie'], per: n(150, 2, 20), def: 2 },
  { names: ['donut', 'doughnut', 'donuts'], per: n(260, 3, 31), def: 1 },
  { names: ['brownie', 'cake', 'cupcake', 'pie'], per: n(350, 4, 50), def: 1 },
  { names: ['candy bar', 'candy', 'chocolate'], per: n(230, 3, 30), def: 1 },

  // --- drinks ---
  // zero-calorie drinks first so 'diet coke' never counts as soda
  { names: ['water', 'sparkling water', 'diet coke', 'coke zero', 'pepsi zero', 'diet soda', 'zero sugar', 'electrolytes', 'liquid iv'], per: n(0, 0, 0), def: 1 },
  { names: ['black coffee', 'coffee', 'tea', 'celsius'], per: n(5, 0, 1), def: 1 },
  { names: ['milkshake', 'milk shake'], per: n(600, 15, 90), def: 1 },
  // a scoop of powder (about 30 g) mixed with water
  { names: ['whey protein shake', 'whey shake', 'protein powder shake', 'whey protein', 'whey isolate', 'protein powder', 'scoops of protein', 'scoop of protein', 'scoops of whey', 'scoop of whey'], per: n(120, 24, 3), def: 1 },
  { names: ['protein shake', 'shake', 'whey'], per: n(160, 30, 6), def: 1 },
  { names: ['smoothie'], per: n(300, 6, 60), def: 1 },
  { names: ['chocolate milk'], per: n(210, 8, 30), def: 1 },
  { names: ['milk'], per: n(150, 8, 12), def: 1 },
  { names: ['latte', 'cappuccino', 'mocha', 'frappuccino'], per: n(220, 11, 28), def: 1 },
  { names: ['orange juice', 'juice', 'lemonade'], per: n(110, 1.5, 26), def: 1 },
  { names: ['soda', 'coke', 'pepsi', 'sprite', 'dr pepper', 'mountain dew'], per: n(150, 0, 39), def: 1 },
  { names: ['gatorade', 'powerade', 'sports drink'], per: n(140, 0, 36), def: 1 },
  { names: ['monster'], per: n(210, 0, 54), def: 1 },
  { names: ['red bull', 'energy drink'], per: n(110, 0, 28), def: 1 },
  { names: ['beer', 'beers'], per: n(150, 1.6, 13), def: 1 },
  { names: ['wine'], per: n(125, 0.1, 4), def: 1 },
  { names: ['seltzer', 'white claw', 'truly'], per: n(100, 0, 2), def: 1 },
];

const WORD_NUMS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, dozen: 12, couple: 2, few: 3, half: 0.5,
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sizeFactor(part: string): number {
  if (/\b(huge|giant|massive|xl|extra large)\b/.test(part)) return 1.8;
  if (/\b(large|big|lg)\b/.test(part)) return 1.4;
  if (/\b(small|little|sm|snack size|mini)\b/.test(part)) return 0.65;
  if (/\bhalf (a|an|of)\b/.test(part)) return 0.5;
  return 1;
}

/** A count right before the food name: "3 eggs", "two slices of pizza", "10 wings". */
function countBefore(part: string, name: string): number | null {
  const m = part.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${Object.keys(WORD_NUMS).join('|')})\\s+(?:(?:slices?|pieces?|pcs?|scoops?|servings?|cups?|bowls?|cans?|bottles?|glasses?|strips?|of|large|small|big|scrambled|fried|boiled|hard boiled)\\s+)*${esc(name)}\\b`));
  if (!m) return null;
  const v = m[1];
  return /^\d/.test(v) ? parseFloat(v) : WORD_NUMS[v] ?? null;
}

/** Ounces given for a meat: "8 oz steak", "half pound of chicken", "1/2 lb". */
function ouncesIn(part: string): number | null {
  const oz = part.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b/);
  if (oz) return parseFloat(oz[1]);
  const lb = part.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/);
  if (lb) return parseFloat(lb[1]) * 16;
  if (/\b(half[- ]?(a )?pound|1\/2\s*(lb|pound))/.test(part)) return 8;
  if (/\b(third[- ]?pound|1\/3\s*(lb|pound))/.test(part)) return 5.3;
  if (/\b(quarter[- ]?pound|1\/4\s*(lb|pound)|quarter pounder)/.test(part)) return 4;
  if (/\bpound of\b|\ba pound\b/.test(part)) return 16;
  return null;
}

function add(a: Nutrition, b: Nutrition, k = 1): Nutrition {
  return { calories: a.calories + b.calories * k, protein: a.protein + b.protein * k, carbs: a.carbs + b.carbs * k };
}

/** Burgers are built from their parts so "half pound western bacon cheeseburger" adds up right. */
function burger(part: string): Nutrition {
  const rawOz = ouncesIn(part) ?? 4;
  const patties = /\b(double|2 patty|two patty)\b/.test(part) ? 2 : /\btriple\b/.test(part) ? 3 : 1;
  const cookedOz = rawOz * 0.75 * patties;
  let t = n(0, 0, 0);
  t = add(t, n(77, 7.3, 0), cookedOz); // 80/20 beef, cooked
  t = add(t, n(150, 5, 27)); // bun
  t = add(t, n(60, 1, 5)); // lettuce, tomato, sauce
  if (/\b(cheese|cheeseburger)\b/.test(part)) t = add(t, n(100, 6, 1), patties);
  if (/\bbacon\b/.test(part)) t = add(t, n(90, 6, 0));
  if (/\b(western|onion rings?|bbq|barbecue)\b/.test(part)) t = add(t, n(170, 1, 26));
  if (/\b(egg)\b/.test(part)) t = add(t, n(90, 6, 0.4));
  if (/\b(avocado|guac)\b/.test(part)) t = add(t, n(60, 1, 3));
  return t;
}

/**
 * Estimate nutrition for a food or drink description.
 * Returns null when nothing recognizable was found.
 */
/** True when the text names a food or drink from the curated list ("chipotle bowl", "quest bar"). */
export function isCuratedFood(text: string): boolean {
  const s = ` ${text.toLowerCase()} `;
  return FOODS.some((f) => f.names.some((nm) => new RegExp(`\\b${esc(nm)}\\b`).test(s)));
}

export function estimateNutrition(text: string): Nutrition | null {
  let s = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  // keep compound dishes together before splitting
  s = s
    .replace(/\bmac (and|n|&) cheese\b/g, 'mac and cheese')
    .replace(/\bpeanut butter (and|&) jelly\b/g, 'pb&j')
    .replace(/\bbiscuits (and|&) gravy\b/g, 'biscuits and gravy');
  const protectedDish = ['mac and cheese', 'biscuits and gravy'];
  let tmp = s;
  protectedDish.forEach((d, i) => (tmp = tmp.split(d).join(`__dish${i}__`)));
  const parts = tmp
    .split(/,|;|\+|&(?!j)|\band\b|\bwith\b|\bplus\b|\bthen\b/)
    .map((p) => {
      let q = p;
      protectedDish.forEach((d, i) => (q = q.split(`__dish${i}__`).join(d)));
      return q.trim();
    })
    .filter(Boolean);

  let total: Nutrition | null = null;
  for (const raw0 of parts) {
    const raw = raw0.replace(/\b(for|as)\s+(my\s+)?(breakfast|lunch|dinner|brunch|a snack|snack|dessert|pre-workout|post-workout)\b/g, ' ').trim();
    let part = ` ${raw} `;
    let partTotal: Nutrition | null = null;
    let curatedDish = false;
    const consumed: string[] = [];
    for (const food of FOODS) {
      const name = food.names.find((nm) => new RegExp(`\\b${esc(nm)}\\b`).test(part));
      if (!name) continue;
      consumed.push(name);
      if (food.dish || food.names.includes('burger')) curatedDish = true;
      let v: Nutrition;
      if (food.names.includes('burger')) {
        v = burger(part);
        const c = countBefore(part, name);
        if (c && c > 1) v = { calories: v.calories * c, protein: v.protein * c, carbs: v.carbs * c };
      } else if (food.perOz) {
        const oz = ouncesIn(part) ?? (food.defOz ?? 4) * sizeFactor(part);
        v = add(n(0, 0, 0), food.perOz, oz);
      } else {
        const count = countBefore(part, name) ?? food.def;
        v = add(n(0, 0, 0), food.per, count * (countBefore(part, name) ? 1 : sizeFactor(part)));
      }
      partTotal = partTotal ? add(partTotal, v) : v;
      if (food.dish) break;
      // don't match the same words twice ("egg whites" then "egg")
      part = part.replace(new RegExp(`\\b${esc(name)}\\b`), ' ');
    }
    // The USDA table (52k foods) catches everything the short list doesn't,
    // and wins when it matches more of the description ("chicken tikka masala", "big mac").
    const meaningful = tokenize(raw).length;
    const consumedWords = tokenize(consumed.join(' ')).length;
    const db = meaningful ? estimateFromDb(raw) : null;
    const zeroCurated = partTotal && partTotal.calories === 0 && partTotal.protein === 0 && partTotal.carbs === 0;
    if (db && !curatedDish && (!partTotal || (db.coverage >= 0.99 && db.matched > consumedWords)) && !zeroCurated) {
      partTotal = { calories: db.calories, protein: db.protein, carbs: db.carbs };
    }
    if (partTotal) total = total ? add(total, partTotal) : partTotal;
  }
  if (!total || (total.calories === 0 && total.protein === 0 && total.carbs === 0)) return null;
  return {
    calories: Math.round(total.calories / 5) * 5,
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
  };
}

/** Fill in estimated calories/protein/carbs on a food or drink entry that has none of its own. */
export function withEstimate<T extends { category: string; text: string; calories?: number; protein?: number; carbs?: number; nutritionEstimated?: boolean }>(
  e: T,
  sourceText?: string,
): T {
  if (e.category !== 'food' && e.category !== 'drink') return e;
  if (e.calories !== undefined || e.protein !== undefined || e.carbs !== undefined) return e;
  // "lunch" alone says nothing about what was eaten, so don't make numbers up
  if (/^\s*(breakfast|lunch|dinner|brunch|snack|a snack|meal|a meal|dessert|food|drink|drinks)\s*$/i.test(e.text)) return e;
  const est = estimateNutrition(sourceText ?? e.text) ?? (sourceText ? estimateNutrition(e.text) : null);
  // a number this big means the text was misread (gym numbers, prices), not a real meal
  if (!est || est.calories > 5000) return e;
  return { ...e, ...est, nutritionEstimated: true };
}
