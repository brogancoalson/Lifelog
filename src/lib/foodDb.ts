/**
 * Offline search over ~52,000 USDA FoodData Central foods (public domain).
 * Values are per 100 g; each food has one typical portion in grams.
 * The table is parsed and indexed the first time it's needed.
 */
import { FOOD_CATEGORIES, FOODS_TXT } from '../data/foods.txt';

export interface DbFood {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number; // one typical portion
  category: string;
  branded: boolean;
  tokens: string[];
}

export interface DbMatch {
  food: DbFood;
  coverage: number; // share of the query's meaning that matched (0-1)
  matched: number; // how many query words matched
}

// Words that carry no food meaning (or describe amounts, which are handled separately).
const STOP = new Set(
  (
    'a an the of with and or in on for to from my some w i ive im we me just also then ate eat eating had have having ' +
    'drank drink drinking got grabbed made cooked finished snacked like about around today yesterday tonight morning ' +
    'night evening afternoon earlier ns nfs as to type style further specified not other made from include includes ' +
    'one two three four five six seven eight nine ten dozen couple few half quarter third whole piece pieces pc pcs ' +
    'slice slices cup cups bowl bowls can cans bottle bottles glass glasses serving servings scoop scoops plate plates ' +
    'oz ounce ounces lb lbs pound pounds g gram grams ml tbsp tablespoon tablespoons tsp teaspoon teaspoons ' +
    'large big small little medium huge giant massive xl extra regular size sized mini jumbo lg sm md order side'
  ).split(' '),
);

/** "eggs" -> "egg", "fries" -> "fry", "potatoes" -> "potato". */
export function stem(w: string): string {
  if (w.length <= 3) return w;
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (/(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string, keepStop = false): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\bbig mac\b/g, 'bigmac')
    .replace(/\bwhopper jr\b/g, 'whopperjr')
    .replace(/\bhalf and half\b/g, 'halfandhalf')
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !/^\d/.test(w));
  const out: string[] = [];
  for (const w of words) {
    if (!keepStop && STOP.has(w)) continue;
    out.push(stem(w));
  }
  return out;
}

let FOODS: DbFood[] | null = null;
let INDEX: Map<string, number[]> | null = null;
let IDF: Map<string, number> | null = null;

function load() {
  if (FOODS) return;
  const lines = FOODS_TXT.split('\n');
  const foods: DbFood[] = new Array(lines.length);
  const index = new Map<string, number[]>();
  for (let i = 0; i < lines.length; i++) {
    const [name, kcal, protein, carbs, fat, grams, cat, branded] = lines[i].split('|');
    const tokens = [...new Set(tokenize(name))];
    foods[i] = {
      name,
      kcal: +kcal || 0,
      protein: +protein || 0,
      carbs: +carbs || 0,
      fat: +fat || 0,
      grams: +grams || 100,
      category: FOOD_CATEGORIES[+cat] ?? '',
      branded: branded === '1',
      tokens,
    };
    for (const t of tokens) {
      const list = index.get(t);
      if (list) list.push(i);
      else index.set(t, [i]);
    }
  }
  const idf = new Map<string, number>();
  const n = foods.length;
  index.forEach((list, t) => idf.set(t, Math.log(1 + n / list.length)));
  FOODS = foods;
  INDEX = index;
  IDF = idf;
}

export function foodCount(): number {
  load();
  return FOODS!.length;
}

/** Best USDA match for a short food description, or null if nothing fits well. */
export function searchFood(text: string, minCoverage = 0.7): DbMatch | null {
  load();
  const q = [...new Set(tokenize(text))];
  if (!q.length) return null;
  const idf = IDF!;
  const index = INDEX!;
  // unknown words still count against coverage, but only a little (could be a typo or a brand we lack)
  const weight = (t: string) => idf.get(t) ?? 2;
  const total = q.reduce((a, t) => a + weight(t), 0);

  const hits = new Map<number, number>(); // food -> matched idf
  const counts = new Map<number, number>();
  for (const t of q) {
    const list = index.get(t);
    if (!list) continue;
    const w = idf.get(t)!;
    for (const id of list) {
      hits.set(id, (hits.get(id) ?? 0) + w);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  let best: DbMatch | null = null;
  let bestScore = 0;
  const first = q[0];
  hits.forEach((m, id) => {
    if (_restrict && !_restrict.has(id)) return;
    const f = FOODS![id];
    const coverage = m / total;
    if (coverage < minCoverage) return;
    const matched = counts.get(id)!;
    const extra = f.tokens.length - matched;
    let score = coverage * 10;
    score /= 1 + 0.12 * Math.max(0, extra); // prefer simple names ("Egg, whole, fried" over "Egg omelet with ham and cheese")
    if (!f.branded) score *= 1.35; // prefer standard foods over packaged brands
    const head = f.name.split(',')[0].toLowerCase();
    if (tokenize(head).every((t) => q.includes(t))) score *= 1.3; // "Egg, ..." for "eggs"
    if (/\bnfs\b/i.test(f.name)) score *= 1.15; // "not further specified" = the generic version
    if (f.tokens[0] === first) score *= 1.1;
    const lowerText = text.toLowerCase();
    if (/\b(uncooked|dry|dried|powder|mix|frozen, unprepared|dehydrated|concentrate)\b/i.test(f.name) && !/\b(dry|dried|powder|mix|concentrate)\b/.test(lowerText)) score *= 0.75;
    if (/\braw\b/i.test(f.name) && /poultry|beef|pork|lamb|fish|chicken|turkey|sausage|meat|egg/i.test(f.category + ' ' + f.name) && !/\braw\b/.test(lowerText)) score *= 0.7;
    if (/\b(canned|creamed|pickled|frozen|imitation|substitute|reduced|diet|low|lite|light|fat free|sugar free|unsweetened|toaster|school lunch)\b/i.test(f.name) && !/\b(canned|creamed|pickled|frozen|imitation|substitute|reduced|diet|low|lite|light|free|unsweetened|toaster|school)\b/.test(lowerText)) score *= 0.85;
    if (/\braw\b/i.test(f.name) && /fruit|vegetable|berries|apples|bananas|melons|citrus|grapes|mango|pears|peaches/i.test(f.category)) score *= 1.05;
    if (/\b(nfs|whole|cooked|plain|regular|original)\b/i.test(f.name)) score *= 1.08;
    // a restaurant or brand name the person didn't say ("McDONALD'S, McFLURRY with OREO") is probably not it
    const paren = f.name.match(/^(.*?)\(([^)]+)\)/);
    const capsBrand = /^[A-Z][A-Z'&.\- ]{2,},/.test(f.name);
    const brandPart = paren ? paren[2] : capsBrand ? f.name.split(',')[0] : '';
    const productPart = paren ? paren[1] : capsBrand ? f.name.split(',').slice(1).join(',') : '';
    if (brandPart && !tokenize(brandPart).some((b) => q.includes(b))) {
      const product = tokenize(productPart);
      const namedExactly = product.length > 0 && product.every((t) => q.includes(t));
      score *= namedExactly ? 1 : 0.6;
    }
    if (score > bestScore) {
      bestScore = score;
      _lastScore = score;
      best = { food: f, coverage, matched };
    }
  });
  return best;
}

// --- portions --------------------------------------------------------------

/** Weight of one countable item, by food word. */
const UNIT_GRAMS: Record<string, number> = {
  egg: 50, banana: 118, apple: 182, orange: 131, pear: 178, peach: 150, plum: 66, kiwi: 75, mango: 200, avocado: 150,
  strawberry: 12, grape: 5, cherry: 8, date: 8, almond: 1.2, peanut: 1, cashew: 1.6, walnut: 4, pretzel: 6, chip: 2,
  cracker: 4, cookie: 20, oreo: 11, brownie: 60, donut: 60, doughnut: 60, muffin: 110, bagel: 100, croissant: 60,
  biscuit: 60, pancake: 40, waffle: 75, tortilla: 45, taco: 100, burrito: 350, enchilada: 150, tamale: 130,
  wing: 32, nugget: 16, tender: 45, strip: 8, drumstick: 75, thigh: 90, breast: 170, meatball: 30, sausage: 25,
  link: 25, patty: 113, hotdog: 98, frank: 50, shrimp: 7, scallop: 15, oyster: 15, dumpling: 25, potsticker: 25,
  roll: 50, bun: 50, potato: 170, carrot: 60, pickle: 35, olive: 4, slider: 100, sandwich: 200, burger: 220,
  cheeseburger: 220, hamburger: 200, sub: 300, wrap: 250, quesadilla: 180, pizza: 107, samosa: 60, eggroll: 85,
  spring: 60, pierogi: 40, ravioli: 12, sushi: 30, nigiri: 30, bar: 60, cupcake: 70, macaron: 15,
};

/** Weight of one slice, by food word. */
const SLICE_GRAMS: Record<string, number> = { pizza: 107, bread: 28, toast: 28, cheese: 21, ham: 14, turkey: 14, bacon: 8, cake: 80, pie: 125, bologna: 23, salami: 10, pepperoni: 2, watermelon: 280, pineapple: 84, tomato: 20 };

/** Weight of one cup, by food word (cooked / as eaten). */
const CUP_GRAMS: Record<string, number> = {
  rice: 158, pasta: 140, spaghetti: 140, noodle: 160, macaroni: 200, cereal: 30, oatmeal: 234, oat: 234, grits: 240,
  milk: 244, soup: 245, chili: 256, stew: 245, bean: 172, yogurt: 245, ice: 132, cream: 132, fruit: 150, berry: 148,
  salad: 60, lettuce: 50, spinach: 30, broccoli: 90, corn: 150, pea: 160, potato: 210, coffee: 240, juice: 248, water: 237,
  cottage: 226, quinoa: 185, popcorn: 8, granola: 120, trail: 150, nut: 140, almond: 143, smoothie: 240,
};

function lookup(table: Record<string, number>, tokens: string[]): number | null {
  for (let i = tokens.length - 1; i >= 0; i--) if (table[tokens[i]] !== undefined) return table[tokens[i]];
  return null;
}

const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, dozen: 12, couple: 2, few: 3, several: 3, half: 0.5,
};

function leadingCount(text: string): number | null {
  const m = text.match(/(?:^|\s)(\d+(?:\.\d+)?|\d+\/\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|couple|few|several|half)(?=\s)/);
  if (!m) return null;
  const v = m[1];
  if (/^\d+\/\d+$/.test(v)) {
    const [a, b] = v.split('/').map(Number);
    return b ? a / b : null;
  }
  return /^\d/.test(v) ? parseFloat(v) : WORD_NUM[v] ?? null;
}

function explicitGrams(text: string): number | null {
  const g = text.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/);
  if (g) return parseFloat(g[1]);
  const oz = text.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b/);
  if (oz) return parseFloat(oz[1]) * 28.35;
  const lb = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/);
  if (lb) return parseFloat(lb[1]) * 453.6;
  if (/\bhalf[- ]?(a )?pound|1\/2\s*(lb|pound)/.test(text)) return 227;
  if (/\bquarter[- ]?pound|1\/4\s*(lb|pound)/.test(text)) return 113;
  if (/\bml\b/.test(text)) {
    const ml = text.match(/(\d+(?:\.\d+)?)\s*ml\b/);
    if (ml) return parseFloat(ml[1]);
  }
  return null;
}

function sizeFactor(text0: string): number {
  const text = text0.replace(/\bbig mac\b/g, '');
  if (/\b(huge|giant|massive|xl|extra large|jumbo)\b/.test(text)) return 1.7;
  if (/\b(large|big|lg)\b/.test(text)) return 1.35;
  if (/\b(small|little|sm|mini|snack size)\b/.test(text)) return 0.65;
  return 1;
}

/** How many grams the description means, for a matched food. */
export function portionGrams(text: string, food: DbFood): number {
  const t = ` ${text.toLowerCase()} `;
  const direct = explicitGrams(t);
  if (direct) return direct;
  const q = tokenize(text);
  const count = leadingCount(t);
  const n = count ?? 1;
  if (/\bslices?\b/.test(t)) return n * (lookup(SLICE_GRAMS, q) ?? 28);
  if (/\bbowls?\b/.test(t)) return n * 1.5 * (lookup(CUP_GRAMS, q) ?? 200);
  if (/\bcups?\b/.test(t)) return n * (lookup(CUP_GRAMS, q) ?? 200);
  if (/\bcans?\b/.test(t)) return n * 355;
  if (/\bbottles?\b/.test(t)) return n * 500;
  if (/\bglass(es)?\b/.test(t)) return n * 240;
  if (/\b(tbsp|tablespoons?)\b/.test(t)) return n * 15;
  if (/\b(tsp|teaspoons?)\b/.test(t)) return n * 5;
  if (/\bscoops?\b/.test(t)) return n * (q.includes('ice') || q.includes('cream') ? 66 : 32);
  const unit = lookup(UNIT_GRAMS, q);
  if (unit) {
    // plain plural with no number ("eggs", "wings") means a normal helping
    if (count === null) {
      const plural = /\b(eggs|wings|nuggets|tacos|pancakes|cookies|sliders|meatballs|shrimp|strips|links|sausages|dumplings|pieces)\b/.test(t);
      const helping: Record<string, number> = { egg: 2, wing: 6, nugget: 8, taco: 3, pancake: 3, cookie: 2, slider: 2, meatball: 5, shrimp: 10, strip: 3, link: 2, sausage: 2, dumpling: 6 };
      const k = q.find((w) => helping[w] !== undefined);
      return unit * (plural && k ? helping[k] : 1) * sizeFactor(t);
    }
    return n * unit;
  }
  const mealish = /Frozen Dinners|Entrees|Prepared|Cooked|mixed dishes|Soups|Pizza/i.test(food.category);
  const base = food.branded && mealish ? Math.max(food.grams, 250) : food.grams;
  return (count ?? 1) * base * (count === null ? sizeFactor(t) : 1);
}

export interface DbEstimate {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  coverage: number;
  matched: number;
}

/** Top matches with scores, for testing. */
export function debugSearch(text: string, n = 5): { name: string; category: string; grams: number; branded: boolean }[] {
  load();
  const out: { name: string; category: string; grams: number; branded: boolean; score: number }[] = [];
  const q = [...new Set(tokenize(text))];
  const seen = new Set<number>();
  for (const t of q) for (const id of INDEX!.get(t) ?? []) seen.add(id);
  seen.forEach((id) => {
    const f = FOODS![id];
    const one = searchFoodAmong(text, [id]);
    if (one) out.push({ name: f.name, category: f.category, grams: f.grams, branded: f.branded, score: one });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}

let _restrict: Set<number> | null = null;
let _lastScore = 0;
function searchFoodAmong(text: string, ids: number[]): number {
  _restrict = new Set(ids);
  _lastScore = 0;
  const m = searchFood(text);
  _restrict = null;
  return m ? _lastScore : 0;
}

export function estimateFromDb(text: string): DbEstimate | null {
  const m = searchFood(text);
  if (!m) return null;
  const g = portionGrams(text, m.food);
  const k = g / 100;
  return {
    name: m.food.name,
    grams: Math.round(g),
    calories: m.food.kcal * k,
    protein: m.food.protein * k,
    carbs: m.food.carbs * k,
    fat: m.food.fat * k,
    coverage: m.coverage,
    matched: m.matched,
  };
}
