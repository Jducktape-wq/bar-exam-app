/* ============================================================
   QUIZ CORE
   Picks what each question asks and offers. Pure functions: no DOM,
   no network, and a swappable random source so tests can replay a run.
   js/app.js renders what these return; tests/honest.test.mjs plays
   thousands of questions as someone who has never seen the menu.

   Honest-question rules (Sep 23 audit: a player who knew nothing
   scored 77% on the kitchen pack's first level):
   1. Nothing on the card may give the answer away. While a question
      is up, every word from every option is hidden in the card's text
      sections (Method, Allergens, Glass & Garnish...). Hiding the wrong
      answers' words too means a hidden word says "an option is here,"
      not which one.
   2. Wrong amounts use the right answer's unit ("oz" with "oz"), and
      two ways of writing one amount ("3/4 oz" and ".75 oz.") never
      both appear.
   3. Packs whose cards mostly lack amounts (imported menus) don't get
      amount questions at all.
   ============================================================ */
(function(root){
  'use strict';

  let rnd = Math.random;
  function setRandom(fn){ rnd = fn || Math.random; }
  function randInt(n){ return Math.floor(rnd() * n); }
  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function sample(arr, n){ return shuffle(arr).slice(0, n); }

  /* ---------------- names ---------------- */
  function normIngName(str){
    return (str || '').toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .split(',')[0]
      .replace(/[.'’]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  // Two different strings that a player would read as the same thing
  // ("Lime Juice" and "Fresh Lime Juice"). Identical strings return
  // false: they never co-appear as options.
  function looksSame(a, b){
    if(a === b) return false;
    const na = normIngName(a), nb = normIngName(b);
    if(!na || !nb) return false;
    if(na === nb) return true;
    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length <= nb.length ? nb : na;
    return (' ' + longer + ' ').indexOf(' ' + shorter + ' ') !== -1;
  }

  /* ---------------- hiding words ---------------- */
  // Words that carry no answer on their own. Hiding them would black
  // out half the method for nothing.
  const STOP = new Set(('a an and or of the with for to in on at per each plus into over from then ' +
    'fresh whole large small medium chopped sliced diced grated minced dried ground house cold hot warm ' +
    'room temp temperature extra fine finely thin thick cut half quarter top bottom side skin our your').split(' '));

  function keywords(phrase){
    return String(phrase || '').toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .split(/[^a-z]+/)
      .filter(w => w.length >= 3 && !STOP.has(w));
  }

  // One word as a pattern that also catches its plural or singular.
  function wordPattern(w){
    if(/ies$/.test(w)) return w.slice(0, -3) + '(?:y|ies)';
    if(/(?:o|ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2) + '(?:es)?';
    if(/[^s]s$/.test(w)) return w.slice(0, -1) + 's?';
    if(/[^aeiou]y$/.test(w)) return w.slice(0, -1) + '(?:y|ies)';
    if(/(?:o|ch|sh|x|ss)$/.test(w)) return w + '(?:es)?';
    return w + 's?';
  }

  // A pattern that finds every option's words in a block of text, or
  // null when there's nothing worth hiding.
  function maskPattern(options){
    const words = [...new Set([].concat(options || []).flatMap(keywords))];
    if(!words.length) return null;
    words.sort((a, b) => b.length - a.length);
    return new RegExp('\\b(?:' + words.map(wordPattern).join('|') + ')\\b', 'gi');
  }

  // Split text into plain and hidden pieces: [{text, hidden}].
  function maskSegments(text, rx){
    const s = String(text || '');
    if(!rx) return [{ text: s, hidden: false }];
    const out = [];
    let last = 0;
    rx.lastIndex = 0;
    let m;
    while((m = rx.exec(s))){
      if(m.index > last) out.push({ text: s.slice(last, m.index), hidden: false });
      out.push({ text: m[0], hidden: true });
      last = m.index + m[0].length;
      if(m[0].length === 0) rx.lastIndex++;
    }
    if(last < s.length) out.push({ text: s.slice(last), hidden: false });
    return out;
  }

  /* ---------------- amounts ---------------- */
  const FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  const UNITS = [
    [/^(?:oz|ozs|ounces?|fl ?oz)$/, 'oz'], [/^(?:ml|milliliters?|millilitres?)$/, 'ml'], [/^cl$/, 'cl'],
    [/^(?:tbsp|tbs|tablespoons?)$/, 'tbsp'], [/^(?:tsp|teaspoons?)$/, 'tsp'], [/^(?:cups?|c)$/, 'cup'],
    [/^(?:dash(?:es)?)$/, 'dash'], [/^(?:drops?)$/, 'drop'], [/^(?:barspoons?|bsp)$/, 'barspoon'],
    [/^(?:lbs?|pounds?)$/, 'lb'], [/^(?:qts?|quarts?)$/, 'qt'], [/^(?:pints?|pt)$/, 'pint'],
    [/^(?:gal|gallons?)$/, 'gal'], [/^(?:g|grams?)$/, 'g'], [/^(?:kg|kilos?|kilograms?)$/, 'kg'],
    [/^(?:slices?)$/, 'slice'], [/^(?:sprigs?)$/, 'sprig'], [/^(?:cloves?)$/, 'clove'],
    [/^(?:leaf|leaves)$/, 'leaf'], [/^(?:fillets?)$/, 'fillet'], [/^(?:pieces?|pcs?)$/, 'piece'],
    [/^(?:wedges?)$/, 'wedge'], [/^(?:pinch(?:es)?)$/, 'pinch'], [/^(?:shots?)$/, 'shot'], [/^(?:parts?)$/, 'part']
  ];

  // "1 1/2 oz." -> {qty: 1.5, unit: 'oz'}; "Top" -> {qty: null, unit: 'top'};
  // "3-4 Dashes" -> {qty: '3-4', unit: 'dash'}; "" -> null.
  function parseAmount(raw){
    let s = String(raw || '').toLowerCase().trim();
    if(!s) return null;
    s = s.replace(/([a-z])\./g, '$1').replace(/\s+/g, ' ');
    const m = s.match(/^((?:\d+\s+)?\d+\/\d+|\d*\.\d+|\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])?(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(.*)$/);
    let qty = null;
    if(m && (m[1] || m[2])){
      let v = 0;
      if(m[1]){
        const parts = m[1].trim().split(/\s+/);
        parts.forEach(p => {
          if(p.includes('/')){ const [a, b] = p.split('/').map(Number); v += b ? a / b : 0; }
          else v += Number(p);
        });
      }
      if(m[2]) v += FRAC[m[2]];
      qty = Math.round(v * 1000) / 1000;
      if(m[3]) qty = qty + '-' + Number(m[3]);
    }
    const rest = (m ? m[4] : s).trim();
    const first = rest.split(' ')[0] || '';
    const two = rest.split(' ').slice(0, 2).join(' ');
    let unit = null;
    for(const [rx, name] of UNITS){ if(rx.test(two)){ unit = name; break; } if(rx.test(first)){ unit = name; break; } }
    if(!unit) unit = rest.replace(/[^a-z ]/g, '').trim();
    return { qty, unit };
  }
  function amountKey(raw){
    const p = parseAmount(raw);
    return p ? (p.qty === null ? '' : p.qty) + '|' + p.unit : '';
  }
  function sameAmount(a, b){ return amountKey(a) !== '' && amountKey(a) === amountKey(b); }

  // Up to n wrong amounts for `correct`: never another way of writing the
  // same amount, never two that mean the same, same unit first.
  function amountDecoys(correct, pool, n){
    n = n === undefined ? 3 : n;
    const ck = amountKey(correct);
    const cp = parseAmount(correct);
    const seen = new Set([ck]);
    const cands = [];
    shuffle(pool || []).forEach(a => {
      const k = amountKey(a);
      if(!k || seen.has(k)) return;
      seen.add(k);
      cands.push(a);
    });
    const unitOf = a => (parseAmount(a) || {}).unit;
    const same = cands.filter(a => cp && unitOf(a) === cp.unit);
    const picks = same.slice(0, n);
    if(picks.length < n) picks.push(...cands.filter(a => !picks.includes(a)).slice(0, n - picks.length));
    return picks;
  }

  // Imported menus often list ingredients without amounts. Amount
  // questions only make sense when most rows have one.
  function hasAmounts(items){
    const rows = (items || []).flatMap(it => it.ingredients || []);
    if(!rows.length) return false;
    const withQty = rows.filter(g => { const p = parseAmount(g.amt); return p && p.qty !== null; }).length;
    return withQty / rows.length >= 0.5;
  }
  const AMOUNT_TYPES = new Set(['mcAmount', 'mcAllAmounts']);
  function levelPlayable(level, items){
    return !(level && AMOUNT_TYPES.has(level.type)) || hasAmounts(items);
  }

  function pools(items){
    return {
      items:   [...new Set(items.flatMap(c => c.ingredients.map(i => i.item)))],
      amounts: [...new Set(items.flatMap(c => c.ingredients.map(i => i.amt)).filter(a => a && String(a).trim()))],
      combos:  [...new Set(items.flatMap(c => c.ingredients.map(i => i.amt + ' ' + i.item)))]
    };
  }

  /* ---------------- questions ---------------- */
  // "Which ingredient completes this recipe?" Decoys share the blank's
  // label (another 2 oz. pour, another value of the same attribute) and
  // never appear on the card.
  function nameQuestion(item, pack, cfg, pl){
    cfg = cfg || {};
    const blankIdx = randInt(item.ingredients.length);
    const blank = item.ingredients[blankIdx];
    const correct = blank.item;
    const onCard = new Set(item.ingredients.map(g => g.item));
    const sameLabel = cfg.sameCard
      ? item.ingredients.map(g => g.item).filter(n => n !== correct)
      : [...new Set(pack.items.flatMap(c => c.ingredients.filter(g => g.amt === blank.amt).map(g => g.item)))]
          .filter(n => !onCard.has(n) && !looksSame(n, correct));
    const decoys = sample(sameLabel, 3);
    if(decoys.length < 2){
      const rest = pl.items.filter(n => !onCard.has(n) && !decoys.includes(n) && !looksSame(n, correct));
      decoys.push(...sample(rest, 3 - decoys.length));
    }
    const options = shuffle([correct, ...decoys]);
    return { blankIdx, correct, options, mask: maskPattern(options) };
  }

  // "What's the correct measurement?" Only rows that have an amount.
  function amountQuestion(item, pl){
    const rows = item.ingredients.map((g, i) => i).filter(i => amountKey(item.ingredients[i].amt));
    const blankIdx = rows.length ? rows[randInt(rows.length)] : randInt(item.ingredients.length);
    const correct = item.ingredients[blankIdx].amt;
    const options = shuffle([correct, ...amountDecoys(correct, pl.amounts, 3)]);
    return { blankIdx, correct, options, mask: maskPattern(options) };
  }

  // Every amount at once. Rows without an amount stay as printed.
  function allAmountsQuestion(item, pl){
    const rows = item.ingredients.map((g, i) => i).filter(i => amountKey(item.ingredients[i].amt));
    const optionsByRow = {};
    rows.forEach(i => {
      const amt = item.ingredients[i].amt;
      optionsByRow[i] = shuffle([amt, ...amountDecoys(amt, pl.amounts, 3)]);
    });
    return { rows, optionsByRow, mask: maskPattern(rows.flatMap(i => optionsByRow[i])) };
  }

  // Several whole lines vanish at once.
  function blankQuestion(item, pack, numBlanks, pl){
    const n = item.ingredients.length;
    const count = Math.min(numBlanks, Math.max(1, n - 1));
    const indices = shuffle([...Array(n).keys()]).slice(0, count).sort((a, b) => a - b);
    const line = g => g.amt + ' ' + g.item;
    const corrects = indices.map(idx => line(item.ingredients[idx]));
    const onCard = new Set(item.ingredients.map(line));
    const sameThing = (c, correct, row) => looksSame(c, correct) ||
      pack.items.some(card => card.ingredients.some(g => line(g) === c &&
        normIngName(g.item) === normIngName(row.item) && sameAmount(g.amt, row.amt)));
    const optionsByGroup = indices.map((idx, gi) => {
      const row = item.ingredients[idx];
      const sameLabel = [...new Set(pack.items.flatMap(c =>
        c.ingredients.filter(g => g.amt === row.amt).map(line)))]
        .filter(c => !onCard.has(c) && !sameThing(c, corrects[gi], row));
      let decoys = sample(sameLabel, 3);
      if(decoys.length < 2){
        const rest = pl.combos.filter(c => !onCard.has(c) && !sameThing(c, corrects[gi], row) && !decoys.includes(c));
        decoys = decoys.concat(sample(rest, 3 - decoys.length));
      }
      return shuffle([corrects[gi], ...decoys]);
    });
    return { indices, corrects, optionsByGroup, mask: maskPattern(optionsByGroup.flat()) };
  }

  // Procedure cards: steps up to a point, then "what comes next?"
  function nextQuestion(item, cfg, pack){
    const n = item.ingredients.length;
    const k = randInt(Math.max(0, n - 2) + 1);
    const correct = item.ingredients[k + 1].item;
    let decoys = sample(item.ingredients.slice(k + 2).map(g => g.item), 3);
    if(decoys.length < 3 && cfg.blind){
      const earlier = item.ingredients.slice(0, k).map(g => g.item).filter(t => !decoys.includes(t));
      decoys = decoys.concat(sample(earlier, 3 - decoys.length));
    }
    if(decoys.length < 3){
      const others = [...new Set(pack.items.filter(c => c !== item).flatMap(c => c.ingredients.map(g => g.item)))]
        .filter(t => t !== correct && !decoys.includes(t) && !looksSame(t, correct));
      decoys = decoys.concat(sample(others, 3 - decoys.length));
    }
    const options = shuffle([correct, ...decoys]);
    return { k, correct, options, mask: maskPattern(options) };
  }

  const api = {
    setRandom, randInt, shuffle, sample,
    normIngName, looksSame,
    keywords, maskPattern, maskSegments,
    parseAmount, amountKey, sameAmount, amountDecoys, hasAmounts, levelPlayable, pools,
    nameQuestion, amountQuestion, allAmountsQuestion, blankQuestion, nextQuestion
  };
  root.QuizCore = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
