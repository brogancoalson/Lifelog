"""
Build the app's offline food table from USDA FoodData Central (public domain),
as packaged in the pyfooda wheel (pyfooda/data/fooddata.csv, per-100 g values).

Output: src/data/foods.txt.ts — one line per food:
  name|kcal|protein|carbs|fat|grams|cat
  values are per 100 g; grams = one typical portion; cat = category index
"""
import re, sys, json
import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else 'pyfooda/data/fooddata.csv'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'foods.txt.ts'
BRANDED_CAP = int(sys.argv[3]) if len(sys.argv) > 3 else 45000

cols = ['foodName','data_type','food_category','portion_unit_name','portion_gram_weight','Energy','Carbohydrate','Total fat','Protein']
df = pd.read_csv(SRC, usecols=cols, low_memory=False)
df = df.dropna(subset=['foodName','Energy','Protein','Carbohydrate'])
df = df[(df.Energy >= 0) & (df.Energy <= 902)]

# Typical single portions (grams) for FNDDS categories that have no gram weight here.
CAT_GRAMS = {
  'Burgers': 200, 'Pizza': 107, 'Eggs and omelets': 100, 'Egg/breakfast sandwiches': 150, 'Burritos and tacos': 200,
  'Other Mexican mixed dishes': 250, 'Meat mixed dishes': 250, 'Poultry mixed dishes': 250, 'Seafood mixed dishes': 250,
  'Rice mixed dishes': 250, 'Pasta mixed dishes, excludes macaroni and cheese': 250, 'Macaroni and cheese': 200,
  'Fried rice and lo/chow mein': 250, 'Stir-fry and soy-based sauce mixtures': 250, 'Ramen and Asian broth-based soups': 350,
  'Soups, broth-based': 245, 'Soups, cream-based': 245, 'Deli and cured meat sandwiches': 200, 'Meat and BBQ sandwiches': 200,
  'Chicken patties, nuggets and tenders': 100, 'Chicken, whole pieces': 140, 'Seafood sandwiches': 180, 'Frankfurter sandwiches': 100,
  'Vegetable sandwiches/burgers': 150, 'Peanut butter and jelly sandwiches': 100, 'Egg rolls, dumplings, sushi': 150,
  'Beef, excludes ground': 170, 'Ground beef': 113, 'Pork': 140, 'Lamb, goat, game': 140, 'Turkey, duck, other poultry': 110,
  'Fish': 140, 'Shellfish': 110, 'Sausages': 60, 'Cold cuts and cured meats': 56, 'Bacon': 24, 'Liver and organ meats': 85,
  'Rice': 158, 'Pasta, noodles, cooked grains': 140, 'Yeast breads': 28, 'Rolls and buns': 50, 'Bagels and English muffins': 100,
  'Tortillas': 45, 'Biscuits, muffins, quick breads': 70, 'Pancakes, waffles, French toast': 120, 'Grits and other cooked cereals': 240,
  'Ready-to-eat cereal, higher sugar (>21.2g/100g)': 40, 'Ready-to-eat cereal, lower sugar (=<21.2g/100g)': 40,
  'French fries and other fried white potatoes': 117, 'Mashed potatoes and white potato mixtures': 210, 'White potatoes, baked or boiled': 170,
  'Potato chips': 28, 'Tortilla, corn, other chips': 28, 'Pretzels/snack mix': 28, 'Popcorn': 28, 'Crackers, excludes saltines': 30, 'Saltine crackers': 15,
  'Cookies and brownies': 40, 'Cakes and pies': 100, 'Doughnuts, sweet rolls, pastries': 70, 'Ice cream and frozen dairy desserts': 100,
  'Candy containing chocolate': 45, 'Candy not containing chocolate': 40, 'Pudding': 115, 'Gelatins, ices, sorbets': 100,
  'Cheese': 28, 'Cottage/ricotta cheese': 113, 'Yogurt, regular': 170, 'Yogurt, Greek': 170, 'Milk, whole': 244, 'Milk, reduced fat': 244,
  'Milk, lowfat': 244, 'Milk, nonfat': 244, 'Flavored milk, whole': 250, 'Flavored milk, reduced fat': 250, 'Plant-based milk': 240,
  'Milk shakes and other dairy drinks': 330, 'Smoothies and grain drinks': 350, 'Coffee': 355, 'Tea': 355, 'Soft drinks': 355,
  'Diet soft drinks': 355, 'Sport and energy drinks': 500, 'Diet sport and energy drinks': 355, 'Fruit drinks': 240, 'Citrus juice': 240,
  'Apple juice': 240, 'Other fruit juice': 240, 'Beer': 355, 'Wine': 150, 'Liquor and cocktails': 150, 'Nutritional beverages': 330,
  'Protein and nutritional powders': 30, 'Nutrition bars': 60, 'Cereal bars': 40, 'Nuts and seeds': 28, 'Beans, peas, legumes': 170,
  'Bean, pea, legume dishes': 250, 'Apples': 182, 'Bananas': 118, 'Citrus fruits': 130, 'Grapes': 150, 'Melons': 160,
  'Blueberries and other berries': 145, 'Strawberries': 150, 'Other fruits and fruit salads': 150, 'Dried fruits': 40, 'Broccoli': 90,
  'Carrots': 70, 'Corn': 150, 'Lettuce and lettuce salads': 150, 'Other dark green vegetables': 90, 'Other red and orange vegetables': 120,
  'Other starchy vegetables': 150, 'Other vegetables and combinations': 120, 'Vegetable dishes': 150, 'Fried vegetables': 120,
  'Coleslaw, non-lettuce salads': 120, 'Tomatoes': 120, 'Onions': 50, 'Dips, gravies, other sauces': 60, 'Salad dressings and vegetable oils': 30,
  'Mustard and other condiments': 15, 'Tomato-based condiments': 17, 'Jams, syrups, toppings': 20, 'Sugars and honey': 12,
  'Butter and animal fats': 14, 'Margarine': 14, 'Cream and cream substitutes': 15, 'Cream cheese, sour cream, whipped cream': 30,
  'Olives, pickles, pickled vegetables': 30, 'Turnovers and other grain-based items': 130, 'Soy and meat-alternative products': 100,
  'Vegetables and Vegetable Products': 100, 'Cereal Grains and Pasta': 140, 'Fruits and Fruit Juices': 150, 'Dairy and Egg Products': 100,
  'Finfish and Shellfish Products': 140, 'Nut and Seed Products': 28, 'Legumes and Legume Products': 170, 'Soy-based condiments': 16,
  'String beans': 125, 'Mayonnaise': 14, 'Sugar substitutes': 1, 'Vegetable juice': 240, 'Cabbage': 90, 'Spinach': 90,
  'Vegetables on a sandwich': 20, 'Beef Products': 113, 'Poultry Products': 113, 'Pasta sauces, tomato-based': 125,
  'Chicken fillet sandwiches': 200, 'Flavored milk, lowfat': 250, 'Flavored milk, nonfat': 250, 'Pork Products': 113, 'Nachos': 250,
  'Oatmeal': 240, 'Peaches and nectarines': 150, 'Frankfurters': 50, 'Mango and papaya': 165, 'Pears': 178, 'Pineapple': 165,
  'Flavored or carbonated water': 355, 'Baked Products': 60, 'Plant-based yogurt': 170, 'Lamb, Veal, and Game Products': 113,
  'Cheese sandwiches': 140, 'Sausages and Luncheon Meats': 56, 'Other diet drinks': 355, 'Restaurant Foods': 250, 'Tap water': 240,
  'Enhanced water': 500, 'Bottled water': 500, 'Beverages': 240, 'Fats and Oils': 14, 'Soups, Sauces, and Gravies': 245, 'Sweets': 40,
  'Salad dressings and vegetable oils': 30, 'Not included in a food category': 100,
}
# baby food and formula aren't useful for this app
SKIP_GENERIC_PREFIX = ('Baby', 'Formula')
DEFAULT_GRAMS = 150

def num(x, nd=1):
    try:
        v = float(x)
    except Exception:
        return None
    if v != v or v in (float('inf'), float('-inf')):
        return None
    return round(v, nd)

SIZE_RE = re.compile(r"\b\d+(\.\d+)?\s?(fl\.?\s?oz|oza|onz|oz|ounce|ounces|g|gr|gm|grams?|lbs?|ct|pk|pack|count|ml|l|kg|cnt)\b\.?", re.I)
PAREN_RE = re.compile(r"\([^)]*\)")

def clean_branded(name: str) -> str:
    n = PAREN_RE.sub(' ', name)
    n = SIZE_RE.sub(' ', n)
    n = re.sub(r"\b\d+\s?x\s?\d+(\.\d+)?\b", ' ', n, flags=re.I)
    n = re.sub(r"[\s,;/]+$", '', re.sub(r"\s{2,}", ' ', n)).strip(' ,-')
    return n

def title(n: str) -> str:
    if n.isupper():
        small = {'and','or','with','of','in','a','the','for','on'}
        words = n.lower().split()
        return ' '.join(w if (i and w in small) else (w[:1].upper() + w[1:]) for i, w in enumerate(words))
    return n

rows = []
cats = {}
def cat_id(c):
    c = c if isinstance(c, str) else ''
    if c not in cats:
        cats[c] = len(cats)
    return cats[c]

generic = df[df.data_type.isin(['survey_fndds_food', 'sr_legacy_food', 'foundation_food'])].copy()
# prefer FNDDS (foods as eaten), then SR, then Foundation
order = {'survey_fndds_food': 0, 'sr_legacy_food': 1, 'foundation_food': 2}
generic['o'] = generic.data_type.map(order)
generic = generic.sort_values(['o'])
seen = set()
for _, r in generic.iterrows():
    if isinstance(r.food_category, str) and r.food_category.startswith(SKIP_GENERIC_PREFIX):
        continue
    name = str(r.foodName).strip().replace('|', '/')
    if name.lower().startswith(('babyfood', 'infant formula', 'child formula')):
        continue
    key = name.lower()
    if key in seen:
        continue
    seen.add(key)
    g = num(r.portion_gram_weight, 0)
    if not g or g <= 0 or g > 1500:
        g = CAT_GRAMS.get(r.food_category, DEFAULT_GRAMS)
    rows.append((title(name), num(r.Energy, 0), num(r.Protein), num(r.Carbohydrate), num(r['Total fat']) or 0, int(g), cat_id(r.food_category), 0))
n_generic = len(rows)

SKIP_CATS = {
  'Seasoning Mixes, Salts, Marinades & Tenderizers', 'Baking Decorations & Dessert Toppings', 'Cake, Cookie & Cupcake Mixes',
  'Pickles, Olives, Peppers & Relishes', 'Water', 'Baking Additives & Extracts', 'Flours & Corn Meal', 'Herbs & Spices',
  'Vegetable & Cooking Oils', 'Baby/Infant  Foods/Beverages', 'Baby Foods', 'Canned & Bottled Beans', 'Cooking Sauces',
  'Oriental, Mexican & Ethnic Sauces', 'Prepared Pasta & Pizza Sauces', 'Ketchup, Mustard, BBQ & Cheese Sauce', 'Sugar & Sugar Substitutes',
  'Syrups & Molasses', 'Gravy Mix', 'Stuffing', 'Baking/Cooking Mixes (Perishable)', 'Baking/Cooking Mixes/Supplies',
}
br = df[(df.data_type == 'branded_food') & (~df.food_category.isin(SKIP_CATS))].copy()
br = br.dropna(subset=['portion_gram_weight'])
br = br[(br.portion_gram_weight > 0) & (br.portion_gram_weight < 1500) & (br.portion_gram_weight == br.portion_gram_weight)]
br['clean'] = br.foodName.astype(str).map(clean_branded)
br = br[br.clean.str.len().between(4, 70)]
br = br[~br.clean.str.contains(r"^\W|^\d", regex=True)]
br['key'] = br.clean.str.lower().str.replace(r"[^a-z0-9 ]", '', regex=True).str.replace(r"\s+", ' ', regex=True)
br = br.drop_duplicates('key')
# prefer names that contain a comma (usually "BRAND, PRODUCT") and are shorter
br['score'] = br.clean.str.contains(',').astype(int) * 10 - br.clean.str.len() / 10
br = br.sort_values('score', ascending=False).head(BRANDED_CAP)
for _, r in br.iterrows():
    key = r.key
    if key in seen:
        continue
    seen.add(key)
    rows.append((title(r.clean.replace('|', '/')), num(r.Energy, 0), num(r.Protein), num(r.Carbohydrate), num(r['Total fat']) or 0,
                 int(round(r.portion_gram_weight)), cat_id(r.food_category), 1))

def fmt(v):
    if v is None:
        return ''
    return str(int(v)) if float(v).is_integer() else str(v)

lines = ['|'.join([n, fmt(k), fmt(p), fmt(c), fmt(f), str(g), str(ci), str(b)]) for (n, k, p, c, f, g, ci, b) in rows]
cat_list = [c for c, _ in sorted(cats.items(), key=lambda kv: kv[1])]
body = '\n'.join(lines)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Generated by scripts/fooddb/build.py from USDA FoodData Central (public domain). Do not edit.\n')
    fh.write('// Line format: name|kcal|protein|carbs|fat|portionGrams|categoryIndex|branded  (nutrients per 100 g)\n')
    fh.write('export const FOOD_CATEGORIES: string[] = ' + json.dumps(cat_list) + ';\n')
    fh.write('export const FOOD_COUNT = ' + str(len(rows)) + ';\n')
    fh.write('export const FOODS_TXT = ' + json.dumps(body) + ';\n')
print('generic', n_generic, 'branded', len(rows) - n_generic, 'total', len(rows), 'bytes', len(body.encode()))
