/* ============================================================
   ALLERGEN READER (used by the "86 It" safety drill)
   Reads the text of a card's Allergens section and returns which of
   the nine major allergens it declares. Two rules drive every choice:

   1. Missing an allergen is the dangerous mistake. The drill could
      then offer that dish as "safe" for a guest who can't eat it. So
      the word lists are wide, and generic words ("nuts") count for
      every allergen they could mean.
   2. A dish may only be offered as the safe choice when its card is
      clear: it names allergens this reader understands, or says
      "none". Anything hedged ("verify", "may contain", "shared
      fryer") or unreadable is never used as a safe answer.

   Same never-guess rule as the photo importer: only what the card
   declares counts. Nothing here infers allergens from dish names.
   ============================================================ */
(function(root){
  'use strict';

  const ORDER = ['Shellfish', 'Fish', 'Dairy', 'Egg', 'Gluten', 'Soy', 'Peanut', 'Tree nut', 'Sesame'];

  // Whole-word patterns per allergen, matched after normalize().
  const WORDS = {
    'Shellfish': ['shellfish', 'shrimps?', 'prawns?', 'crabs?', 'crabmeat', 'lobsters?', 'crawfish', 'crayfish',
      'crawdads?', 'langoustines?', 'crustaceans?', 'oysters?', 'clams?', 'mussels?', 'scallops?', 'squid',
      'calamari', 'octopus', 'mollusks?', 'molluscs?', 'conch', 'abalone', 'krill', 'scampi'],
    'Fish': ['\\w*fish(?:es)?', 'anchov(?:y|ies)', 'salmon', 'tuna', 'cod', 'halibut', 'trout', 'bass', 'snapper',
      'grouper', 'mahi(?:[- ]?mahi)?', 'tilapia', 'sardines?', 'mackerel', 'herring', 'haddock', 'pollock',
      'flounder', 'sole', 'branzino', 'bonito', 'caviar', 'roe', 'worcestershire', 'nam pla'],
    'Dairy': ['dairy', 'milks?', 'buttermilk', 'butter', 'creams?', 'cheeses?', 'parmesan', 'parmigiano', 'pecorino',
      'ricotta', 'mozzarella', 'burrata', 'feta', 'cheddar', 'brie', 'gouda', 'mascarpone', 'gruyere',
      'provolone', 'yogh?urts?', 'whey', 'casein(?:ate)?', 'ghee', 'lactose', 'creme fraiche', 'half[- ]and[- ]half',
      'buttercream', 'queso', 'paneer', 'kefir', 'custard'],
    'Egg': ['eggs?', 'yolks?', 'egg ?whites?', 'eggwash', 'mayo', 'mayonnaise', 'aioli', 'meringue', 'albumen',
      'hollandaise', 'bearnaise', 'custard'],
    'Gluten': ['gluten', 'wheat', 'flour', 'breads?', 'breadcrumbs?', 'panko', 'pasta', 'couscous', 'semolina',
      'durum', 'farro', 'spelt', 'barley', 'rye', 'malt', 'bulgur', 'seitan', 'croutons?', 'beer'],
    'Soy': ['soy', 'soya', 'soybeans?', 'tofu', 'edamame', 'miso', 'tamari', 'tempeh', 'shoyu', 'natto'],
    'Peanut': ['peanuts?', 'groundnuts?', 'arachis'],
    'Tree nut': ['treenuts?', 'almonds?', 'walnuts?', 'cashews?', 'pecans?', 'pistachios?', 'hazelnuts?', 'filberts?',
      'macadamias?', 'brazilnuts?', 'pinenuts?', 'pignoli', 'chestnuts?', 'praline', 'marzipan', 'gianduja',
      'nutella', 'frangipane'],
    'Sesame': ['sesame', 'tahini', 'benne', 'gomasio', 'halvah?'],
  };
  const RX = {};
  ORDER.forEach(k => { RX[k] = new RegExp('\\b(?:' + WORDS[k].join('|') + ')\\b'); });
  // "nuts" with no kind named could mean either; a guest with either
  // allergy has to hear about it.
  const GENERIC_NUT = /\bnuts?\b/;

  // Category names a negation or "-free" is allowed to cancel. Kept to
  // category names on purpose: "no substitutions on the shrimp" must
  // never erase the shrimp.
  const CAT = '(?:dairy|milk|lactose|eggs?|fish|shellfish|crustaceans?|nuts?|treenuts?|peanuts?|soy|soya|sesame|gluten|wheat|allergens?)';
  const LIST = CAT + '(?:\\s*(?:,|and|or|\\/)\\s*' + CAT + ')*';
  const NEGATED = new RegExp('\\b(?:no|without|free of|free from|contains no|does not contain|doesnt contain|not made with)\\s+' + LIST + '\\b', 'g');
  const FREE = new RegExp('\\b(' + LIST + ')[- ]free\\b(\\s+[a-z]+)?', 'g');

  // Hedged or open-ended declarations. Never a safe answer.
  const UNCERTAIN = /\b(?:verify|confirm|ask|check|unknown|unsure|unverified|may contain|might contain|can contain|could contain|traces?|cross[- ]?contact|cross[- ]?contam\w*|shared|same fryer|processed in|facility|possible|possibly|tbd|varies|see)\b|\?/;
  const DECLARED_NONE = /\b(?:none|no known allergens?|no allergens?|allergen[- ]free)\b/;

  function normalize(text){
    let t = String(text || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’']/g, '').replace(/&/g, ' and ').replace(/\s+/g, ' ');
    // Join two-word names so the generic "nuts" rule can't double-count.
    t = t.replace(/\b(tree|pine|brazil)\s+(nuts?)\b/g, '$1$2')
      .replace(/\bshell\s+fish\b/g, 'shellfish').replace(/\bcraw\s+fish\b/g, 'crawfish')
      .replace(/\begg\s+wash\b/g, 'eggwash');
    // Look-alikes that aren't the allergen they resemble.
    t = t.replace(/\b(peanut|almond|cashew|sunflower|cocoa|cacao|apple|shea|seed|nut|pumpkin|soy|soya|sesame|pistachio|hazelnut)\s+butter\b/g, '$1')
      .replace(/\b(coconut|oat|almond|soy|soya|rice|cashew|hemp|pea|plant|macadamia|hazelnut|pistachio|flax)\s+(?:milk|cream|yogh?urt|cheese|ice cream)\b/g, '$1')
      .replace(/\bcream of tartar\b/g, ' ')
      .replace(/\bwater chestnuts?\b/g, ' ')
      .replace(/\b(almond|rice|corn|coconut|chickpea|gram|tapioca|potato|cassava|oat|buckwheat|sorghum|teff|quinoa|cauliflower)\s+(?:flour|pasta|bread|noodles?)\b/g, '$1');
    return t;
  }

  function rawCategories(t){
    const found = new Set();
    const fishText = t.replace(/\b(?:shellfish|crawfish|crayfish|jellyfish|starfish)\b/g, ' ');
    ORDER.forEach(k => {
      const src = k === 'Fish' ? fishText : t;
      if(RX[k].test(src)) found.add(k);
    });
    if(GENERIC_NUT.test(t)){ found.add('Peanut'); found.add('Tree nut'); }
    return found;
  }

  function stripNegations(t){
    // "dairy-free", "gluten free bun": drop the category, and the next
    // word too when it only names that same category ("egg-free mayo").
    t = t.replace(FREE, (m, list, next) => {
      if(!next) return ' ';
      const prefix = rawCategories(list);
      const nextCats = rawCategories(next);
      const sameOnly = nextCats.size > 0 && [...nextCats].every(c => prefix.has(c));
      return sameOnly ? ' ' : ' ' + next;
    });
    return t.replace(NEGATED, ' ');
  }

  // Which of the nine the card declares, in a fixed order.
  function parse(text){
    const found = rawCategories(stripNegations(normalize(text)));
    return ORDER.filter(k => found.has(k));
  }

  // True when the card's wording is hedged or open-ended.
  function isUncertain(text){
    return UNCERTAIN.test(normalize(text));
  }

  // May this dish be offered as the safe choice for some allergen?
  // Only if the card is unhedged AND either names allergens this reader
  // understood or plainly says there are none.
  function canBeSafe(text){
    const t = normalize(text);
    if(!t.trim() || UNCERTAIN.test(t)) return false;
    return parse(text).length > 0 || DECLARED_NONE.test(t);
  }

  const api = { ORDER, normalize, parse, isUncertain, canBeSafe };
  root.Allergens = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
