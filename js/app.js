/* ============================================================
   ENGINE
   Generic quiz engine. Knows nothing about cocktails or food —
   it runs whatever content packs registered themselves on
   window.PACKS (see js/data/*.js).

   A pack:
   { id, icon, eyebrow, title, tagline, role, sample?,
     levels: [ {type, count?, title, desc, lives} ],
     items:  [ {name, ingredients:[{amt,item}], sections:[{label,text}]} ] }

   Level types: mcName, mcAmount, mcBlank (needs count), mcAllAmounts.
   ============================================================ */

/* ======================= CONFIG ======================= */
// Connection settings live in js/config.js; all network calls live in
// js/loader.js (window.Backend). This file never talks to Supabase.

const ROUND_LIMIT = 8; // max rounds per level (baseline ran all 16 — too long)

/* ======================= HELPERS ======================= */
function shuffle(arr){ const a = arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function sampleUnique(arr, n){ return shuffle(arr).slice(0, n); }
function randInt(n){ return Math.floor(Math.random()*n); }

// Escape everything that reaches innerHTML. Content data is trusted-ish,
// player names and anything from Supabase are not (REVIEW.md §1.2).
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
  ));
}

/* ======================= STATE ======================= */
const state = {
  pack: null,        // active pack object
  pools: null,       // decoy pools derived from the active pack
  levelIdx: 0,
  rounds: [],        // item indices into pack.items
  roundIdx: 0,
  lives: 0,
  score: 0,
  current: null,
  awaitingTap: false,
  playerName: '',
  questionLog: []
};

// Stars persist per pack per device (baseline lost them on reload).
let starsByPack = {};
try { starsByPack = JSON.parse(localStorage.getItem('ccq_stars') || '{}') || {}; } catch(e){ starsByPack = {}; }
function getStars(){
  const id = state.pack.id;
  if(!Array.isArray(starsByPack[id]) || starsByPack[id].length !== state.pack.levels.length){
    starsByPack[id] = new Array(state.pack.levels.length).fill(0);
  }
  return starsByPack[id];
}
function saveStars(){
  try { localStorage.setItem('ccq_stars', JSON.stringify(starsByPack)); } catch(e){}
}

const screens = {};
['screenJoin','screenPacks','screenLevels','screenQuiz','screenComplete','screenFailed','screenManager'].forEach(id => screens[id] = document.getElementById(id));
function showScreen(id){
  Object.values(screens).forEach(el => el.classList.remove('active'));
  screens[id].classList.add('active');
}

/* ======================= 86 IT: ALLERGEN DRILL ======================= */
// A virtual module built ONLY from dishes with an explicit Allergens
// section on their card. "None known" counts as a declaration; dishes
// with no allergen section never appear. Same never-guess rule as the
// photo importer, applied at quiz speed.
const ALLERGEN_KEYS = [
  { key: 'Shellfish', rx: /shellfish|shrimp|crab|lobster|crustacean|oyster|clam|mussel|scallop/i },
  { key: 'Fish', rx: /(?<!shell)fish|anchov|salmon|tuna|cod\b/i },
  { key: 'Dairy', rx: /dairy|milk|butter|cream|cheese|parmesan|ricotta|yogurt/i },
  { key: 'Egg', rx: /egg/i },
  { key: 'Gluten', rx: /gluten|wheat|flour|bread/i },
  { key: 'Soy', rx: /\bsoy\b|soybean/i },
  { key: 'Peanut', rx: /peanut/i },
  { key: 'Tree nut', rx: /tree nut|almond|walnut|cashew|pecan|pistachio|hazelnut/i },
  { key: 'Sesame', rx: /sesame|tahini/i }
];

function parseAllergens(text){
  return ALLERGEN_KEYS.filter(a => a.rx.test(text)).map(a => a.key);
}

function buildDrillPack(packs){
  const dishes = [];
  packs.forEach(p => (p.items || []).forEach(it => {
    const sec = (it.sections || []).find(sx => /allergen/i.test(sx.label));
    if(sec && sec.text.trim()){
      dishes.push({ name: it.name, text: sec.text.trim(), allergens: parseAllergens(sec.text) });
    }
  }));
  if(dishes.length < 4) return null;
  // must be able to generate at least one question
  if(!buildDrillRounds('drillMix', dishes, 1).length) return null;
  return {
    id: 'drill-86',
    virtual: true,
    icon: '\u26d4',
    eyebrow: 'Safety Drill',
    title: '86 It',
    tagline: `Allergy fire drill, built from the ${dishes.length} dishes with declared allergen data.`,
    dishes,
    levels: [
      { type: 'drill86',   title: 'First Seat',     desc: 'One dish on the ticket is a problem. Find it before it leaves the pass.', lives: 5 },
      { type: 'drillSafe', title: 'Double Seating', desc: 'Only one of these is safe to serve. Find it.', lives: 5 },
      { type: 'drillMix',  title: 'Full Book',      desc: 'Both directions, three lives. Friday night rules.', lives: 3 }
    ],
    items: []
  };
}

function buildDrillRounds(type, dishes, want){
  const target = want || ROUND_LIMIT;
  const mechanics = type === 'drillMix' ? ['drill86', 'drillSafe'] : [type];
  const rounds = [];
  const seen = new Set();
  const present = [...new Set(dishes.flatMap(d => d.allergens))];
  let tries = 0;
  while(rounds.length < target && tries < 200){
    tries++;
    const mech = mechanics[randInt(mechanics.length)];
    const a = present[randInt(present.length)];
    if(!a) break;
    const hot = dishes.filter(d => d.allergens.includes(a));
    const clean = dishes.filter(d => !d.allergens.includes(a));
    let correct, distractors, prompt, why;
    if(mech === 'drill86'){
      if(!hot.length || clean.length < 3) continue;
      correct = hot[randInt(hot.length)];
      distractors = sampleUnique(clean, 3);
      prompt = `Which of these must be 86'd for their order?`;
      why = `${correct.name} is the problem: its card declares ${correct.text}`;
    } else {
      if(!clean.length || hot.length < 3) continue;
      correct = clean[randInt(clean.length)];
      distractors = sampleUnique(hot, 3);
      prompt = `Which of these is safe to serve?`;
      why = `${correct.name} is the safe call. The other three all declare ${a.toLowerCase()}.`;
    }
    const dedupeKey = mech + '|' + a + '|' + correct.name;
    if(seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rounds.push({
      drill: true, mechanic: mech, allergen: a, prompt, why,
      correct: correct.name, correctText: correct.text,
      options: shuffle([correct.name, ...distractors.map(d => d.name)])
    });
  }
  return rounds;
}

function renderDrillRound(spec){
  const card = document.getElementById('quizCard');
  const table = 1 + randInt(20);
  card.innerHTML = `
    <h2>${esc(spec.allergen)} Allergy</h2>
    <div class="qc-section">
      <p class="qc-label">Scenario</p>
      <p class="qc-text">The guest at table ${table} tells their server they have a ${esc(spec.allergen.toLowerCase())} allergy.${spec.mechanic === 'drill86' ? ' The table just ordered all four of these.' : ''}</p>
    </div>
    <div class="qc-section">
      <p class="qc-label">House rule</p>
      <p class="qc-text">Only what a card declares counts. When in doubt, stop the plate and ask the chef. Never guess for the guest.</p>
    </div>
  `;
  state.current = { answered: false };
  renderSingleChoice(spec.prompt, spec.options, (picked, btn) => {
    const ok = picked === spec.correct;
    logQuestion(spec.correct, spec.mechanic, ok, spec.why);
    const grid = document.getElementById('optGrid');
    grid.querySelectorAll('button').forEach(b => {
      if(b.textContent === spec.correct) b.classList.add('correct');
    });
    if(!ok) btn.classList.add('wrong');
    if(ok){ state.score += 10; } else { loseLife(); }
    showFeedback(ok,
      ok ? esc(spec.mechanic === 'drill86'
            ? `${spec.correct} declares ${spec.correctText}`
            : spec.why)
         : esc(spec.why));
  });
}

/* ======================= PACK SELECT ======================= */
function renderPacks(){
  const list = document.getElementById('packList');
  if(!window.PACKS.length){
    list.innerHTML = state.preview
      ? `<div class="mgr-empty">No training packs published yet.<br>Publish one from the dashboard to see it here.</div>`
      : `<div class="mgr-empty">No training packs published yet.<br>Ask your manager to publish one.</div>`;
    return;
  }
  list.innerHTML = window.PACKS.map((p, i) => `
    <div class="level-tile" data-idx="${i}">
      <div class="pack-icon">${esc(p.icon)}</div>
      <div class="level-info">
        <p class="level-title">${esc(p.title)}${p.sample ? '<span class="sample-tag">Sample</span>' : ''}</p>
        <p class="level-desc">${esc(p.tagline)}</p>
      </div>
    </div>`).join('');
  list.querySelectorAll('.level-tile').forEach(tile => {
    tile.addEventListener('click', () => selectPack(parseInt(tile.dataset.idx, 10)));
  });
}

function selectPack(idx){
  state.pack = window.PACKS[idx];
  // Decoy pools come from the active pack only, so bar decoys never
  // leak into kitchen questions and vice versa.
  const items = state.pack.items;
  state.pools = {
    items:   [...new Set(items.flatMap(c => c.ingredients.map(i => i.item)))],
    amounts: [...new Set(items.flatMap(c => c.ingredients.map(i => i.amt)))],
    combos:  [...new Set(items.flatMap(c => c.ingredients.map(i => i.amt + " " + i.item)))]
  };
  document.getElementById('levelSelectEyebrow').textContent = state.pack.eyebrow;
  document.getElementById('levelSelectTitle').textContent = state.pack.title;
  document.getElementById('playerNameDisplay').textContent = state.playerName;
  showScreen('screenLevels');
  renderLevels();
}

/* ======================= LEVEL SELECT ======================= */
function renderLevels(){
  const list = document.getElementById('levelList');
  const stars = getStars();
  list.innerHTML = state.pack.levels.map((lvl, i) => {
    const starStr = stars[i] > 0 ? '★'.repeat(stars[i]) + '☆'.repeat(3 - stars[i]) : '';
    return `
      <div class="level-tile" data-idx="${i}">
        <div class="level-num">${i+1}</div>
        <div class="level-info">
          <p class="level-title">${esc(lvl.title)}</p>
          <p class="level-desc">${esc(lvl.desc)}</p>
          ${starStr ? `<p class="level-meta">${starStr}</p>` : ''}
        </div>
      </div>`;
  }).join('');
  list.querySelectorAll('.level-tile').forEach(tile => {
    tile.addEventListener('click', () => startLevel(parseInt(tile.dataset.idx, 10)));
  });
}

document.getElementById('levelsBackBtn').addEventListener('click', () => { showScreen('screenPacks'); renderPacks(); });
document.getElementById('backBtn').addEventListener('click', () => { showScreen('screenLevels'); renderLevels(); });
document.getElementById('completeToLevels').addEventListener('click', () => { showScreen('screenLevels'); renderLevels(); });
document.getElementById('failedToLevels').addEventListener('click', () => { showScreen('screenLevels'); renderLevels(); });
document.getElementById('failedRetry').addEventListener('click', () => startLevel(state.levelIdx));
document.getElementById('completeNext').addEventListener('click', () => {
  const next = state.levelIdx + 1;
  if(next < state.pack.levels.length) startLevel(next);
  else { showScreen('screenLevels'); renderLevels(); }
});

/* ======================= LEVEL FLOW ======================= */
function startLevel(idx){
  state.levelIdx = idx;
  const cfg = state.pack.levels[idx];
  if(cfg.type && cfg.type.indexOf('drill') === 0){
    state.rounds = buildDrillRounds(cfg.type, state.pack.dishes);
    state.roundIdx = 0;
    state.lives = cfg.lives;
    state.score = 0;
    state.questionLog = [];
    document.getElementById('quizLevelName').textContent = cfg.title;
    document.getElementById('roundTotal').textContent = state.rounds.length;
    updateLivesUI();
    showScreen('screenQuiz');
    loadRound();
    return;
  }
  let pool = state.pack.items.map((c, i) => i);
  // mcBlank levels prefer items with more ingredients than blanks, so at
  // least one ingredient stays visible as an anchor (REVIEW.md §3.1).
  if(cfg.type === 'mcBlank'){
    const pref = pool.filter(i => state.pack.items[i].ingredients.length > cfg.count);
    if(pref.length >= 4) pool = pref;
  }
  state.rounds = sampleUnique(pool, Math.min(pool.length, ROUND_LIMIT));
  state.roundIdx = 0;
  state.lives = cfg.lives;
  state.score = 0;
  state.questionLog = [];
  document.getElementById('quizLevelName').textContent = cfg.title;
  document.getElementById('roundTotal').textContent = state.rounds.length;
  updateLivesUI();
  showScreen('screenQuiz');
  loadRound();
}

function updateLivesUI(){
  const cfg = state.pack.levels[state.levelIdx];
  const el = document.getElementById('livesDisplay');
  let html = '';
  for(let i=0;i<cfg.lives;i++){ html += `<span class="life ${i < state.lives ? '' : 'lost'}">&#9670;</span>`; }
  el.innerHTML = html;
}
function updateRoundUI(){
  document.getElementById('roundNum').textContent = state.roundIdx + 1;
  document.getElementById('scoreDisplay').textContent = 'Score: ' + state.score;
  document.getElementById('roundFill').style.width = ((state.roundIdx + 1) / state.rounds.length * 100) + '%';
}

function loadRound(){
  document.getElementById('feedbackZone').innerHTML = '';
  state.awaitingTap = false;
  updateRoundUI();
  const spec = state.rounds[state.roundIdx];
  if(spec && typeof spec === 'object' && spec.drill){
    renderDrillRound(spec);
    return;
  }
  const item = state.pack.items[state.rounds[state.roundIdx]];
  const cfg = state.pack.levels[state.levelIdx];
  if(cfg.type === 'mcName') buildMCName(item);
  else if(cfg.type === 'mcAmount') buildMCAmount(item);
  else if(cfg.type === 'mcBlank') buildMCBlank(item, cfg.count);
  else if(cfg.type === 'mcAllAmounts') buildMCAllAmounts(item);
}

function nextRound(){
  state.roundIdx++;
  if(state.roundIdx >= state.rounds.length) completeLevel();
  else loadRound();
}

function loseLife(){
  state.lives--;
  updateLivesUI();
}

function completeLevel(){
  const cfg = state.pack.levels[state.levelIdx];
  let earned = 1;
  if(state.lives >= cfg.lives) earned = 3;
  else if(state.lives >= Math.ceil(cfg.lives/2)) earned = 2;
  const stars = getStars();
  stars[state.levelIdx] = Math.max(stars[state.levelIdx], earned);
  saveStars();

  document.getElementById('completeStars').innerHTML =
    Array.from({length:3},(_,i)=> `<span class="${i<earned?'lit':''}">★</span>`).join(' ');
  document.getElementById('completeText').textContent = `Final score: ${state.score}`;
  document.getElementById('completeNext').style.display = (state.levelIdx + 1 < state.pack.levels.length) ? 'inline-block' : 'none';
  saveResult(cfg.title, state.score, state.lives);
  showScreen('screenComplete');
}

/* ======================= QUESTION BUILDERS ======================= */
function buildMCName(item){
  const cfg = state.pack.levels[state.levelIdx];
  const blankIdx = randInt(item.ingredients.length);
  const blank = item.ingredients[blankIdx];
  const correct = blank.item;
  // Prefer decoys that share the blank's label: other values of the
  // same attribute on knowledge cards, other 2 oz. pours on recipes.
  const sameLabel = [...new Set(state.pack.items.flatMap(c =>
    c.ingredients.filter(g => g.amt === blank.amt).map(g => g.item)))]
    .filter(n => n !== correct);
  const decoys = sampleUnique(sameLabel, 3);
  if(decoys.length < 3){
    const rest = state.pools.items.filter(n => n !== correct && !decoys.includes(n));
    decoys.push(...sampleUnique(rest, 3 - decoys.length));
  }
  const options = shuffle([correct, ...decoys]);
  state.current = { answered:false };
  renderRecipeCard(item, { blankItemIdx: blankIdx });
  renderSingleChoice(cfg.prompt || "Which ingredient completes this recipe?", options, (picked, btn) => {
    logQuestion(item.name, 'mcName', picked === correct, correct);
    handleSingleAnswer(picked === correct, correct, btn);
  });
}

function buildMCAmount(item){
  const blankIdx = randInt(item.ingredients.length);
  const correct = item.ingredients[blankIdx].amt;
  const decoys = sampleUnique(state.pools.amounts.filter(a => a !== correct), 3);
  const options = shuffle([correct, ...decoys]);
  state.current = { answered:false };
  renderRecipeCard(item, { blankAmtIdx: blankIdx });
  renderSingleChoice(state.pack.levels[state.levelIdx].prompt || "What's the correct measurement?", options, (picked, btn) => {
    logQuestion(item.name, 'mcAmount', picked === correct, correct);
    handleSingleAnswer(picked === correct, correct, btn);
  });
}

function renderSingleChoice(prompt, options, onPick){
  const area = document.getElementById('answerArea');
  area.innerHTML = `
    <p class="question-prompt">${esc(prompt)}</p>
    <div class="options-grid" id="optGrid"></div>
  `;
  const grid = document.getElementById('optGrid');
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if(state.current.answered) return;
      state.current.answered = true;
      grid.querySelectorAll('button').forEach(b => b.disabled = true);
      onPick(opt, btn);
    });
    grid.appendChild(btn);
  });
}

function handleSingleAnswer(isCorrect, correctText, btnEl){
  const grid = document.getElementById('optGrid');
  grid.querySelectorAll('button').forEach(b => {
    if(b.textContent === correctText) b.classList.add('correct');
  });
  if(!isCorrect) btnEl.classList.add('wrong');

  if(isCorrect){ state.score += 10; }
  else { loseLife(); }

  showFeedback(isCorrect, isCorrect ? "" : `The correct answer was ${esc(correctText)}.`);
}

function buildMCAllAmounts(item){
  const optionsByIng = item.ingredients.map((ing) => {
    const decoys = sampleUnique(state.pools.amounts.filter(a => a !== ing.amt), 3);
    return shuffle([ing.amt, ...decoys]);
  });

  state.current = { selections: new Array(item.ingredients.length).fill(null), answered:false };
  renderRecipeCard(item, { blankAllAmts: true });

  const area = document.getElementById('answerArea');
  const groupsHtml = item.ingredients.map((ing, gi) =>
    `<p class="group-label">${esc(ing.item)}</p><div class="options-grid" id="amtGrid${gi}"></div>`
  ).join('');

  area.innerHTML = `
    <p class="question-prompt">Pick the correct amount for every ingredient.</p>
    ${groupsHtml}
    <div class="submit-row"><button class="primary" id="submitAmounts" disabled>Submit</button></div>
  `;

  item.ingredients.forEach((ing, gi) => {
    const grid = document.getElementById('amtGrid' + gi);
    optionsByIng[gi].forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if(state.current.answered) return;
        grid.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.current.selections[gi] = opt;
        document.getElementById('submitAmounts').disabled = state.current.selections.includes(null);
      });
      grid.appendChild(btn);
    });
  });

  document.getElementById('submitAmounts').addEventListener('click', () => {
    if(state.current.answered) return;
    state.current.answered = true;
    document.querySelectorAll('#answerArea button').forEach(b => b.disabled = true);

    let allCorrect = true;
    item.ingredients.forEach((ing, gi) => {
      const grid = document.getElementById('amtGrid' + gi);
      if(state.current.selections[gi] !== ing.amt) allCorrect = false;
      grid.querySelectorAll('button').forEach(b => {
        if(b.textContent === ing.amt) b.classList.add('correct');
        else if(b.classList.contains('selected')) b.classList.add('wrong');
      });
    });

    if(allCorrect){ state.score += 20; }
    else { loseLife(); }

    const wrongOnes = item.ingredients
      .filter((ing, gi) => state.current.selections[gi] !== ing.amt)
      .map(ing => `${ing.amt} ${ing.item}`);
    logQuestion(item.name, 'mcAllAmounts', allCorrect, wrongOnes);

    showFeedback(allCorrect, allCorrect ? "" : `Correct amounts: ${esc(wrongOnes.join(', '))}.`);
  });
}

function buildMCBlank(item, numBlanks){
  const n = item.ingredients.length;
  // Keep at least one ingredient visible as an anchor (REVIEW.md §3.1).
  const count = Math.min(numBlanks, Math.max(1, n - 1));
  const indices = shuffle([...Array(n).keys()]).slice(0, count).sort((a,b)=>a-b);
  const corrects = indices.map(idx => item.ingredients[idx].amt + " " + item.ingredients[idx].item);

  const optionsByGroup = indices.map((idx, gi) => {
    const pool = state.pools.combos.filter(c => !corrects.includes(c));
    return shuffle([corrects[gi], ...sampleUnique(pool, 3)]);
  });

  state.current = { selections: new Array(count).fill(null), answered:false };
  renderRecipeCard(item, { blankFullIdx: indices });

  const labels = ['A','B','C','D','E'];
  const noun = state.pack.levels[state.levelIdx].noun || 'ingredient';
  const nounCap = noun.charAt(0).toUpperCase() + noun.slice(1);
  const area = document.getElementById('answerArea');
  let groupsHtml = '';
  indices.forEach((idx, gi) => {
    groupsHtml += `<p class="group-label">Mystery ${esc(nounCap)} ${labels[gi]}</p><div class="options-grid" id="blankGrid${gi}"></div>`;
  });
  area.innerHTML = `
    <p class="question-prompt">${count} ${esc(noun)}${count > 1 ? 's' : ''} vanished. Pick what belongs in each blank.</p>
    ${groupsHtml}
    <div class="submit-row"><button class="primary" id="submitBlank" disabled>Submit Answer</button></div>
  `;

  indices.forEach((idx, gi) => {
    const grid = document.getElementById('blankGrid' + gi);
    optionsByGroup[gi].forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if(state.current.answered) return;
        grid.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.current.selections[gi] = opt;
        document.getElementById('submitBlank').disabled = state.current.selections.includes(null);
      });
      grid.appendChild(btn);
    });
  });

  document.getElementById('submitBlank').addEventListener('click', () => {
    if(state.current.answered) return;
    state.current.answered = true;
    document.querySelectorAll('#answerArea button').forEach(b => b.disabled = true);

    let allCorrect = true;
    indices.forEach((idx, gi) => {
      const grid = document.getElementById('blankGrid' + gi);
      if(state.current.selections[gi] !== corrects[gi]) allCorrect = false;
      grid.querySelectorAll('button').forEach(b => {
        if(b.textContent === corrects[gi]) b.classList.add('correct');
        else if(b.classList.contains('selected')) b.classList.add('wrong');
      });
    });

    if(allCorrect){ state.score += 10 * count; }
    else { loseLife(); }
    logQuestion(item.name, 'mcBlank', allCorrect,
      indices.filter((idx, gi) => state.current.selections[gi] !== corrects[gi])
             .map((idx, k) => corrects[indices.indexOf(idx)]));

    showFeedback(allCorrect, allCorrect ? "" : `The missing ingredients were: ${esc(corrects.join(', '))}.`);
  });
}

// Shrink a photo before upload: vision models don't need more than
// ~1500px on the long edge, and restaurant wifi doesn't want 12MP.
function downscalePhoto(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1568;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file couldn\'t be read as a photo.')); };
    img.src = url;
  });
}

/* ======================= RECIPE CARD ======================= */
function renderRecipeCard(item, opts){
  opts = opts || {};
  const card = document.getElementById('quizCard');

  const ingLines = item.ingredients.map((ing, idx) => {
    let amtHtml = esc(ing.amt);
    let itemHtml = esc(ing.item);
    if(opts.blankItemIdx === idx) itemHtml = `<span class="blank">?????</span>`;
    if(opts.blankAmtIdx === idx) amtHtml = `<span class="blank">?????</span>`;
    if(opts.blankAllAmts) amtHtml = `<span class="blank" style="min-width:72px;">?????</span>`;
    if(opts.blankFullIdx && opts.blankFullIdx.includes(idx)){ amtHtml = `<span class="blank">?????</span>`; itemHtml = `<span class="blank">?????</span>`; }
    return `<li>${amtHtml} ${itemHtml}</li>`;
  }).join('');

  const sectionsHtml = item.sections.map(s => `
    <div class="qc-section">
      <p class="qc-label">${esc(s.label)}</p>
      <p class="qc-text">${esc(s.text)}</p>
    </div>`).join('');

  card.innerHTML = `
    <h2>${esc(item.name)}</h2>
    <div class="qc-section">
      <p class="qc-label">Ingredients</p>
      <ul class="qc-ingredients">${ingLines}</ul>
    </div>
    ${sectionsHtml}
  `;
}

/* ======================= FEEDBACK / CONTINUE ======================= */
function showFeedback(isGood, message){
  const zone = document.getElementById('feedbackZone');
  zone.innerHTML = `
    <div class="feedback ${isGood ? 'good':'bad'}">
      <strong>${isGood ? 'Correct' : 'Wrong'}</strong>
      ${message}
      <p class="tap-hint">Tap anywhere to continue</p>
    </div>
  `;
  document.getElementById('scoreDisplay').textContent = 'Score: ' + state.score;
  // On phones the verdict often lands below the fold; bring it into
  // view. Instant, not smooth: smooth scrolling is skipped entirely in
  // some webviews, and a verdict you can't see is worse than a jump.
  const fb = zone.querySelector('.feedback');
  if(fb && fb.scrollIntoView){
    fb.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }
  // Defer activation so the click that triggered this answer doesn't immediately advance.
  setTimeout(() => { state.awaitingTap = true; }, 0);
}

document.getElementById('screenQuiz').addEventListener('click', (e) => {
  if(!state.awaitingTap) return;
  if(e.target.closest('#backBtn')) return;
  state.awaitingTap = false;
  if(state.lives <= 0){
    // Failed runs are where the misses live; record them.
    saveResult(state.pack.levels[state.levelIdx].title, state.score, 0, false);
    showScreen('screenFailed');
  }
  else { nextRound(); }
});

/* ======================= BACKEND (see js/loader.js) ======================= */
// Per-question telemetry (idea board): one entry per round, misses
// carry the correct answers that were missed. Foundation for Burn
// List and the Weakest-Item Report.
function logQuestion(itemName, type, ok, missed){
  state.questionLog.push(Object.assign(
    { item: itemName, type, ok },
    ok ? {} : { missed: [].concat(missed || []) }
  ));
}

function saveResult(levelTitle, score, livesRemaining, completed){
  if(!window.Backend || state.preview) return;
  window.Backend.saveResult({
    player_name: state.playerName,
    pack_id: state.pack.virtual ? null : state.pack.id,
    level_title: levelTitle,
    score,
    lives_remaining: livesRemaining,
    completed: completed !== false,
    questions: state.questionLog
  });
}

/* ======================= MANAGER MODE ======================= */
// Real auth (docs/DESIGN.md P2): email + password via Supabase, RLS does
// the rest. The baseline's five-tap gesture and client-side password are
// gone. A manager can sign in from any device, including one where a
// trainee is signed in; the sessions don't interfere.
let mgrMemberships = [];
let mgrRid = null;

let mgrSignupMode = false;

function mgrShowPane(pane){  // 'login' | 'create' | 'dashboard' | 'forgot' | 'reset'
  ['login', 'create', 'dashboard', 'forgot', 'reset'].forEach(p => {
    const el = document.getElementById(p === 'dashboard' ? 'mgr-dashboard' : 'mgr-' + p + '-screen');
    el.style.display = p === pane ? 'block' : 'none';
  });
  showScreen('screenManager');
}

function openManagerMode(signup){
  if(window.Backend.manager.isSignedIn()){
    enterManagerDashboard();
  } else {
    mgrSignupMode = !!signup;
    renderAuthMode();
    document.getElementById('mgrEmailInput').value = '';
    document.getElementById('mgrPassInput').value = '';
    document.getElementById('mgrLoginErr').textContent = '';
    document.getElementById('mgrAuthNote').textContent = '';
    mgrShowPane('login');
  }
}

function renderAuthMode(){
  document.getElementById('mgrAuthEyebrow').textContent = mgrSignupMode ? 'Setup · Step 1 of 2' : 'Manager Access';
  document.getElementById('mgrAuthTitle').textContent = mgrSignupMode ? 'Create Your Account' : 'Manager Sign-In';
  document.getElementById('mgrLoginBtn').textContent = mgrSignupMode ? 'Create Account' : 'Sign In';
  document.getElementById('mgrAuthToggle').textContent = mgrSignupMode
    ? 'Have an account? Sign in'
    : 'New here? Set up your restaurant';
  document.getElementById('mgrPassInput').setAttribute('autocomplete', mgrSignupMode ? 'new-password' : 'current-password');
}

document.getElementById('mgrAuthToggle').addEventListener('click', e => {
  e.preventDefault();
  mgrSignupMode = !mgrSignupMode;
  document.getElementById('mgrLoginErr').textContent = '';
  document.getElementById('mgrAuthNote').textContent = '';
  renderAuthMode();
});

function exitManagerMode(){
  if(window.Backend.hasTraineeSession()){
    showScreen('screenPacks'); renderPacks();
    return;
  }
  // No trainee join on this device, but a signed-in manager still has
  // a main menu: their own restaurant's published packs, as a preview.
  if(window.Backend.manager.isSignedIn() && mgrRid){
    window.PACKS = mgrPacks.filter(p => p.is_published).map(p => ({
      id: p.id, icon: p.icon || '\ud83d\udccb', eyebrow: p.eyebrow || '',
      tagline: p.tagline || '', title: p.title, levels: p.levels,
      items: (p.items || []).map(i => ({ name: i.name, ingredients: i.ingredients, sections: i.sections }))
    }));
    const drill = buildDrillPack(window.PACKS);
    if(drill) window.PACKS.push(drill);
    state.preview = true;
    state.playerName = 'Manager';
    const mem = mgrMemberships.find(m => m.restaurant.id === mgrRid);
    document.getElementById('packsSub').textContent =
      (mem ? mem.restaurant.name + ' \u00b7 ' : '') + 'Manager preview \u2014 plays here aren\'t recorded';
    document.getElementById('mgrTrigger').textContent = 'Back to Manager Dashboard';
    showScreen('screenPacks');
    renderPacks();
    return;
  }
  showScreen('screenJoin');
}

async function enterManagerDashboard(){
  mgrShowPane('dashboard');
  document.getElementById('mgrContent').innerHTML = '<div class="mgr-loading">Loading...</div>';
  try {
    mgrMemberships = await window.Backend.manager.memberships();
  } catch(e){
    // Session died (e.g. revoked); fall back to the login screen.
    window.Backend.manager.signOut();
    openManagerMode();
    return;
  }
  if(!mgrMemberships.length){
    // Fresh account: name the restaurant before anything else.
    document.getElementById('mgrRestNameInput').value = '';
    document.getElementById('mgrCreateErr').textContent = '';
    mgrShowPane('create');
    return;
  }
  const sel = document.getElementById('mgrRestaurantSel');
  sel.innerHTML = mgrMemberships.map(m =>
    `<option value="${esc(m.restaurant.id)}">${esc(m.restaurant.name)}</option>`).join('');
  sel.style.display = mgrMemberships.length > 1 ? 'block' : 'none';
  if(!mgrRid || !mgrMemberships.some(m => m.restaurant.id === mgrRid)){
    mgrRid = mgrMemberships[0].restaurant.id;
  }
  sel.value = mgrRid;
  renderTrialBanner();
  renderManagerDashboard();
}

/* ======================= TRIAL / PLAN ======================= */
function subscribeCta(){
  const cfg = window.APP_CONFIG;
  const href = cfg.PAYMENT_LINK
    || ('mailto:' + cfg.CONTACT_EMAIL + '?subject=' + encodeURIComponent('Subscribe my restaurant'));
  const external = cfg.PAYMENT_LINK ? ' target="_blank" rel="noopener"' : '';
  return `<a class="tb-cta" href="${esc(href)}"${external}>Subscribe</a>`;
}

function trialDaysLeft(restaurant){
  const elapsed = Math.floor((Date.now() - new Date(restaurant.created_at).getTime()) / 86400000);
  return window.APP_CONFIG.TRIAL_DAYS - elapsed;
}

function renderTrialBanner(){
  const el = document.getElementById('trialBanner');
  const m = mgrMemberships.find(m => m.restaurant.id === mgrRid);
  if(!m || m.restaurant.plan === 'active'){
    el.style.display = 'none';
    return;
  }
  el.style.display = 'flex';
  if(m.restaurant.plan === 'suspended'){
    el.className = 'trial-banner ended';
    el.innerHTML = `<span class="tb-text"><strong>Account paused.</strong> Staff can't train until it's reactivated.</span>${subscribeCta()}`;
    return;
  }
  const left = trialDaysLeft(m.restaurant);
  if(left > 0){
    el.className = 'trial-banner ok';
    el.innerHTML = `<span class="tb-text"><strong>Free trial:</strong> ${left} day${left === 1 ? '' : 's'} left. Subscribe any time to keep your team training.</span>${subscribeCta()}`;
  } else {
    el.className = 'trial-banner ended';
    el.innerHTML = `<span class="tb-text"><strong>Trial ended.</strong> Your content is safe, but staff can't train until you subscribe.</span>${subscribeCta()}`;
  }
}

document.getElementById('mgrRestaurantSel').addEventListener('change', e => {
  mgrRid = e.target.value;
  mgrView = { mode: 'packs' };            // never carry an editor view across restaurants
  renderTrialBanner();
  renderManagerDashboard();
});

async function doManagerLogin(){
  const email = document.getElementById('mgrEmailInput').value.trim();
  const pass = document.getElementById('mgrPassInput').value;
  const err = document.getElementById('mgrLoginErr');
  const note = document.getElementById('mgrAuthNote');
  const btn = document.getElementById('mgrLoginBtn');
  if(!email || !pass){ err.textContent = 'Enter your email and password.'; return; }
  if(mgrSignupMode && pass.length < 8){ err.textContent = 'Password needs at least 8 characters.'; return; }
  btn.disabled = true;
  btn.textContent = mgrSignupMode ? 'Creating...' : 'Signing in...';
  err.textContent = '';
  note.textContent = '';
  try {
    if(mgrSignupMode){
      const r = await window.Backend.manager.signUp(email, pass);
      if(r.needsConfirm){
        mgrSignupMode = false;
        renderAuthMode();
        note.textContent = 'Almost there: confirm the email we just sent you, then sign in here.';
        return;
      }
      enterManagerDashboard();  // no memberships yet -> name-your-restaurant step
    } else {
      await window.Backend.manager.signIn(email, pass);
      enterManagerDashboard();
    }
  } catch(e){
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
    renderAuthMode();
  }
}

document.getElementById('mgrCreateBtn').addEventListener('click', async () => {
  const name = document.getElementById('mgrRestNameInput').value.trim();
  const err = document.getElementById('mgrCreateErr');
  const btn = document.getElementById('mgrCreateBtn');
  if(name.length < 2){ err.textContent = 'Give your restaurant a name.'; return; }
  btn.disabled = true;
  btn.textContent = 'Creating...';
  err.textContent = '';
  try {
    await window.Backend.manager.createRestaurant(name);
    mgrRid = null;                       // pick up the new restaurant
    await enterManagerDashboard();       // Content tab opens with the
                                         // first-run guide for empty packs
  } catch(e){
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Restaurant';
  }
});
document.getElementById('mgrRestNameInput').addEventListener('keydown', e => {
  if(e.key === 'Enter') document.getElementById('mgrCreateBtn').click();
});
document.getElementById('mgrCreateBackBtn').addEventListener('click', () => {
  window.Backend.manager.signOut();
  exitManagerMode();
});

/* ---- password reset ---- */
// Loader calls this when a recovery link from the reset email lands.
function openPasswordReset(){
  document.getElementById('mgrResetPass').value = '';
  document.getElementById('mgrResetErr').textContent = '';
  mgrShowPane('reset');
}

document.getElementById('mgrForgotLink').addEventListener('click', e => {
  e.preventDefault();
  // Carry over whatever they already typed on the sign-in form.
  document.getElementById('mgrForgotEmail').value = document.getElementById('mgrEmailInput').value.trim();
  document.getElementById('mgrForgotErr').textContent = '';
  document.getElementById('mgrForgotNote').textContent = '';
  mgrShowPane('forgot');
});

document.getElementById('mgrForgotBackBtn').addEventListener('click', () => mgrShowPane('login'));

document.getElementById('mgrForgotBtn').addEventListener('click', async () => {
  const email = document.getElementById('mgrForgotEmail').value.trim();
  const err = document.getElementById('mgrForgotErr');
  const note = document.getElementById('mgrForgotNote');
  const btn = document.getElementById('mgrForgotBtn');
  if(!email){ err.textContent = 'Enter your account email.'; return; }
  btn.disabled = true;
  btn.textContent = 'Sending...';
  err.textContent = '';
  note.textContent = '';
  try {
    await window.Backend.manager.requestPasswordReset(email);
    note.textContent = 'If that email has an account, a reset link is on its way. Check spam too, then open the link on this device.';
  } catch(e){
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
});

document.getElementById('mgrResetBtn').addEventListener('click', async () => {
  const pass = document.getElementById('mgrResetPass').value;
  const err = document.getElementById('mgrResetErr');
  const btn = document.getElementById('mgrResetBtn');
  if(pass.length < 8){ err.textContent = 'Password needs at least 8 characters.'; return; }
  btn.disabled = true;
  btn.textContent = 'Saving...';
  err.textContent = '';
  try {
    await window.Backend.manager.completePasswordReset(pass);
    enterManagerDashboard();  // recovery session is now the manager session
  } catch(e){
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Password';
  }
});
document.getElementById('mgrResetPass').addEventListener('keydown', e => {
  if(e.key === 'Enter') document.getElementById('mgrResetBtn').click();
});

document.getElementById('mgrTrigger').addEventListener('click', openManagerMode);
document.getElementById('mgrJoinTrigger').addEventListener('click', e => { e.preventDefault(); openManagerMode(); });
document.getElementById('mgrLoginBtn').addEventListener('click', doManagerLogin);
document.getElementById('mgrPassInput').addEventListener('keydown', e => { if(e.key==='Enter') doManagerLogin(); });
document.getElementById('mgrSignOutBtn').addEventListener('click', () => {
  window.Backend.manager.signOut();
  mgrMemberships = []; mgrRid = null;
  exitManagerMode();
});
document.getElementById('mgrBackBtn').addEventListener('click', exitManagerMode);
document.getElementById('mgrDashBackBtn').addEventListener('click', exitManagerMode);
document.getElementById('mgrRefreshBtn').addEventListener('click', renderManagerDashboard);

document.querySelectorAll('.mgr-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mgr-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderManagerTab(tab.dataset.tab);
  });
});

let mgrData = null;
let mgrPacks = [];
let mgrView = { mode: 'packs', packId: null, itemId: null };

async function renderManagerDashboard(){
  document.getElementById('mgrContent').innerHTML = '<div class="mgr-loading">Loading...</div>';
  const [results, packs] = await Promise.all([
    window.Backend.manager.results(mgrRid),
    window.Backend.manager.packs(mgrRid).catch(() => [])
  ]);
  mgrData = results;
  mgrPacks = packs;
  renderManagerTab(document.querySelector('.mgr-tab.active').dataset.tab);
}

function renderManagerTab(tab){
  const el = document.getElementById('mgrContent');
  if(tab === 'content') renderContentTab(el);
  else if(tab === 'players') el.innerHTML = renderPlayersTab();
  else if(tab === 'recent') el.innerHTML = renderRecentTab();
  else el.innerHTML = renderSetupTab();
}

/* ======================= CONTENT EDITOR ======================= */
// The paid feature (docs/DESIGN.md "Manager experience"): managers edit
// their restaurant's packs and items from a phone. Deliberately dumb
// forms: two repeating row types that mirror the jsonb exactly.

async function refetchPacks(){
  mgrPacks = await window.Backend.manager.packs(mgrRid);
  renderManagerTab('content');
}

function edFail(e){
  const err = document.getElementById('edErr');
  if(err) err.textContent = e.message;
  else alert(e.message);
}

function renderContentTab(el){
  if(mgrView.mode === 'binder') renderBinderReview(el);
  else if(mgrView.mode === 'item') renderItemEditor(el);
  else if(mgrView.mode === 'pack') renderPackEditor(el);
  else renderPackList(el);
}

/* ---- Binder Mode: bulk photo import review queue ---- */
let binderPending = null;   // [{checked, name, ingredients, sections}]

/* Menu-aware level names. Imports classify what came in; when the
   pack's level titles are still exactly a template set, they swap to
   the matching theme. Renamed-by-hand levels are never touched, and
   the manager's lives settings survive the swap. Template ids:
   "bar" = drink names, "kitchen" = food names. */
const DRINK_WORDS = /gin\b|vodka|\brum\b|tequila|mezcal|whisk|bourbon|\brye\b|scotch|brandy|cognac|vermouth|liqueur|bitters|campari|aperol|amaro|prosecco|champagne|shake|shaken|stir|strain|coupe|highball|collins|nick & nora|martini/gi;
const FOOD_WORDS = /chicken|beef|pork|lamb|shrimp|salmon|tuna|halibut|pasta|risotto|cheese|parmesan|flour|butter|onion|garlic|tomato|saut\u00e9|sautee|roast|bake|grill|braise|sear|fry|oven|allergen|plating|station|\bcup\b|\bcups\b|tbsp|\btsp\b|\blb\b|\blbs\b/gi;

function classifyMenuItems(items){
  let drink = 0, food = 0;
  items.forEach(it => {
    const text = [it.name,
      ...(it.ingredients || []).map(g => (g.amt || '') + ' ' + (g.item || '')),
      ...(it.sections || []).map(sx => (sx.label || '') + ' ' + (sx.text || ''))
    ].join(' ');
    const d = (text.match(DRINK_WORDS) || []).length;
    const f = (text.match(FOOD_WORDS) || []).length;
    if(d > f) drink++;
    else if(f > d) food++;
  });
  if(drink === food) return null;
  return drink > food ? 'drink' : 'food';
}

function themedLevelsFor(kind, current){
  const tpls = window.TEMPLATES || [];
  const target = tpls.find(t => t.id === (kind === 'food' ? 'kitchen' : 'bar'));
  if(!target || !current || !current.length) return null;
  const titleKey = ls => ls.map(l => l.title).join('|');
  if(!tpls.some(t => titleKey(t.levels) === titleKey(current))) return null;
  if(titleKey(current) === titleKey(target.levels)) return null;
  return current.map((l, i) => Object.assign({}, l,
    target.levels[i] ? { title: target.levels[i].title, desc: target.levels[i].desc } : {}));
}
let binderSummary = '';

function renderBinderReview(el){
  const p = mgrPacks.find(x => x.id === mgrView.packId);
  if(!p || !binderPending || !binderPending.length){
    binderPending = null;
    mgrView = { mode: p ? 'pack' : 'packs', packId: p && p.id };
    return renderContentTab(el);
  }
  const countChecked = () => binderPending.filter(r => r.checked).length;
  el.innerHTML = `
    <button class="ghost" id="bdBack" style="margin-bottom:4px;">← Back to ${esc(p.title)}</button>
    <p class="ed-label">Review your photo import</p>
    <p class="ed-note">${esc(binderSummary)}. Untick anything that came out wrong; details are editable after adding. Nothing is saved until you add.</p>
    ${binderPending.map((r, i) => `
      <div class="item-row" style="align-items:flex-start;">
        <input type="checkbox" data-bd="${i}" ${r.checked ? 'checked' : ''} style="margin-top:4px; width:18px; height:18px; accent-color:var(--brass); flex-shrink:0;">
        <details style="flex:1; min-width:0;">
          <summary style="cursor:pointer;">${esc(r.name)} <span style="opacity:0.55; font-size:12px;">· ${r.ingredients.length} ingredient${r.ingredients.length === 1 ? '' : 's'} · ${r.sections.length} section${r.sections.length === 1 ? '' : 's'}</span></summary>
          <div style="font-size:13px; opacity:0.75; margin-top:6px; line-height:1.5;">
            ${r.ingredients.map(g => esc((g.amt + ' ' + g.item).trim())).join('<br>')}
            ${r.sections.map(sx => `<br><b>${esc(sx.label)}:</b> ${esc(sx.text.slice(0, 140))}${sx.text.length > 140 ? '…' : ''}`).join('')}
          </div>
        </details>
      </div>`).join('')}
    <div class="ed-actions">
      <button class="primary" id="bdAdd">Add ${countChecked()} recipe${countChecked() === 1 ? '' : 's'}</button>
      <button class="ghost" id="bdDiscard" style="border-color:var(--bad); color:var(--bad);">Discard all</button>
    </div>
    <p class="mgr-err" id="edErr"></p>
  `;

  const refreshAddLabel = () => {
    const n = countChecked();
    const b = document.getElementById('bdAdd');
    b.textContent = `Add ${n} recipe${n === 1 ? '' : 's'}`;
    b.disabled = n === 0;
  };
  el.querySelectorAll('[data-bd]').forEach(cb => cb.addEventListener('change', () => {
    binderPending[parseInt(cb.dataset.bd, 10)].checked = cb.checked;
    refreshAddLabel();
  }));

  const leave = () => {
    binderPending = null;
    mgrView = { mode: 'pack', packId: p.id };
    renderContentTab(el);
  };
  document.getElementById('bdBack').addEventListener('click', leave);
  document.getElementById('bdDiscard').addEventListener('click', leave);

  document.getElementById('bdAdd').addEventListener('click', async () => {
    const chosen = binderPending.filter(r => r.checked);
    if(!chosen.length) return;
    const b = document.getElementById('bdAdd');
    b.disabled = true;
    b.textContent = 'Adding...';
    try {
      let maxPos = p.items.reduce((m, it) => Math.max(m, it.position), -1);
      await window.Backend.manager.createItems(chosen.map(r => ({
        pack_id: p.id, name: r.name,
        ingredients: r.ingredients,
        sections: r.sections.length ? r.sections : [{ label: 'Method', text: '' }],
        position: ++maxPos
      })));
      const kind = classifyMenuItems(chosen);
      const themed = themedLevelsFor(kind, p.levels);
      if(themed){
        try { await window.Backend.manager.updatePack(p.id, { levels: themed }); } catch(eLv){ /* naming is a nicety; the import already landed */ }
      }
      binderPending = null;
      mgrView = { mode: 'pack', packId: p.id };
      await refetchPacks();
      const n2 = document.getElementById('edPhotoNote');
      if(n2) n2.textContent = `Added ${chosen.length} recipe${chosen.length === 1 ? '' : 's'}.` +
        (themed ? ` Levels were renamed for a ${kind} menu (edit any of them below).` : '') +
        ` Review each against the originals (especially allergens) before publishing.`;
    } catch(e2){
      edFail(e2);
      b.disabled = false;
      refreshAddLabel();
    }
  });
}

function renderPackList(el){
  const tpls = window.TEMPLATES || [];
  el.innerHTML = `
    <div class="ed-actions" style="margin-top:0;">
      <button class="ghost" id="edNewPack">+ New pack</button>
      <button class="ghost" id="edNewTpl">+ New from template</button>
    </div>
    <div id="edTplBox" style="display:${mgrPacks.length ? 'none' : 'block'};">
      <div class="mgr-setup">
        <strong>Start from a template</strong>
        ${tpls.map((t, i) => `
          <div class="ed-row" style="align-items:center;">
            <span class="grow">${esc(t.icon)} ${esc(t.title)} · ${t.items.length} items</span>
            <button class="ghost" data-tpl="${i}">Clone</button>
          </div>`).join('')}
        <label class="ed-note" style="display:block; cursor:pointer;">
          <input type="checkbox" id="edAllergenOk">
          I understand template allergen data is sample only and must be
          verified against our own recipes before staff train on it.
        </label>
        <p class="mgr-err" id="edTplErr"></p>
      </div>
    </div>
    <p class="mgr-err" id="edErr"></p>
    ${mgrPacks.map(p => `
      <div class="level-tile" data-pack="${esc(p.id)}">
        <div class="pack-icon">${esc(p.icon || '📋')}</div>
        <div class="level-info">
          <p class="level-title">${esc(p.title)} <span class="chip-pub ${p.is_published ? 'live' : 'draft'}">${p.is_published ? 'Live' : 'Draft'}</span></p>
          <p class="level-desc">${p.items.length} item${p.items.length === 1 ? '' : 's'}${p.tagline ? ' · ' + esc(p.tagline) : ''}</p>
        </div>
      </div>`).join('') || ''}
    ${mgrPacks.length ? '' : `
      <div class="mgr-setup">
        <strong>Welcome! Three steps to a trained staff:</strong>
        1. Add your menu: clone a starter pack above, tap "+ New pack" to
        type your own, or open any pack and use 📷 Add from photo to read
        your recipe cards.<br>
        2. Packs start as Drafts only you can see. Publish when it looks
        right.<br>
        3. The Setup tab has the join code and QR your staff scan to
        start training.
      </div>`}
  `;

  el.querySelectorAll('[data-pack]').forEach(tile => tile.addEventListener('click', () => {
    mgrView = { mode: 'pack', packId: tile.dataset.pack };
    renderContentTab(el);
  }));

  document.getElementById('edNewTpl').addEventListener('click', () => {
    const box = document.getElementById('edTplBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('edNewPack').addEventListener('click', async () => {
    try {
      const levels = structuredClone((window.TEMPLATES && window.TEMPLATES[0]) ? window.TEMPLATES[0].levels : []);
      const rows = await window.Backend.manager.createPack({
        restaurant_id: mgrRid, title: 'New Pack', icon: '📋',
        eyebrow: 'Staff Training', tagline: '',
        levels, is_published: false, position: mgrPacks.length
      });
      mgrView = { mode: 'pack', packId: rows[0].id };
      await refetchPacks();
    } catch(e){ edFail(e); }
  });

  el.querySelectorAll('[data-tpl]').forEach(btn => btn.addEventListener('click', async () => {
    const t = tpls[parseInt(btn.dataset.tpl, 10)];
    const needsAllergenAck = t.items.some(it => (it.sections || []).some(s => /allergen/i.test(s.label)));
    if(needsAllergenAck && !document.getElementById('edAllergenOk').checked){
      document.getElementById('edTplErr').textContent = 'Tick the allergen box first: this template includes sample allergen data.';
      return;
    }
    btn.disabled = true; btn.textContent = 'Cloning...';
    try {
      const rows = await window.Backend.manager.createPack({
        restaurant_id: mgrRid, title: t.title, icon: t.icon,
        eyebrow: t.eyebrow, tagline: t.tagline,
        levels: structuredClone(t.levels), is_published: false, position: mgrPacks.length
      });
      const packId = rows[0].id;
      await window.Backend.manager.createItems(t.items.map((it, i) => ({
        pack_id: packId, name: it.name,
        ingredients: it.ingredients, sections: it.sections, position: i
      })));
      mgrView = { mode: 'pack', packId };
      await refetchPacks();
    } catch(e){
      document.getElementById('edTplErr').textContent = e.message;
      btn.disabled = false; btn.textContent = 'Clone';
    }
  }));
}

function renderPackEditor(el){
  const p = mgrPacks.find(x => x.id === mgrView.packId);
  if(!p){ mgrView = { mode: 'packs' }; return renderPackList(el); }
  el.innerHTML = `
    <button class="ghost" id="edBack" style="margin-bottom:4px;">← All packs</button>
    <p class="ed-label">Pack</p>
    <div class="ed-row">
      <input class="mgr-input" id="edIcon" style="flex:0 0 64px; text-align:center;" maxlength="4" value="${esc(p.icon || '')}" placeholder="🍸" aria-label="Icon">
      <input class="mgr-input grow" id="edTitle" maxlength="60" value="${esc(p.title)}" placeholder="Pack title" aria-label="Title">
    </div>
    <div class="ed-row"><input class="mgr-input grow" id="edEyebrow" maxlength="40" value="${esc(p.eyebrow || '')}" placeholder="Small heading above the title (e.g. Bar Exam)" aria-label="Eyebrow"></div>
    <div class="ed-row"><input class="mgr-input grow" id="edTagline" maxlength="120" value="${esc(p.tagline || '')}" placeholder="One-line description staff see" aria-label="Tagline"></div>
    <p class="ed-label">Levels — quiz mechanics are fixed</p>
    <div class="ed-row" style="margin-bottom:2px;">
      <span class="grow" style="font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(243,234,217,0.45);">Level name</span>
      <span style="flex:0 0 70px; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(243,234,217,0.45); text-align:center;">Set lives</span>
    </div>
    ${p.levels.map((l, i) => `
      <div class="ed-row">
        <input class="mgr-input grow" data-lvl-title="${i}" maxlength="40" value="${esc(l.title)}" aria-label="Level ${i + 1} name">
        <input class="mgr-input" data-lvl-lives="${i}" type="number" min="1" max="9" style="flex:0 0 70px;" value="${l.lives}" aria-label="Level ${i + 1} lives">
      </div>`).join('')}
    <div class="ed-actions">
      <button class="primary" id="edSavePack">Save Pack</button>
      <button class="ghost" id="edPublish">${p.is_published ? 'Unpublish' : 'Publish'}</button>
      <button class="ghost" id="edDeletePack" style="border-color:var(--bad); color:var(--bad);">Delete Pack</button>
    </div>
    <p class="ed-note">${p.is_published ? 'Live: staff can train on this pack now.' : 'Draft: invisible to staff until you publish.'}</p>
    <p class="mgr-err" id="edErr"></p>
    <p class="ed-label">Items</p>
    ${p.items.map((it, i) => `
      <div class="item-row">
        <button class="mini-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="mini-btn" data-down="${i}" ${i === p.items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        <span class="ttl" data-open-item="${esc(it.id)}">${esc(it.name)}</span>
        <button class="ed-x" data-del-item="${esc(it.id)}" aria-label="Delete item">✕</button>
      </div>`).join('') || '<p class="ed-note">No items yet. Staff can\'t train on an empty pack.</p>'}
    <div class="ed-actions">
      <button class="ghost" id="edAddItem">+ Add item</button>
      <button class="ghost" id="edPhotoBtn">📷 Add from photos</button>
      <input type="file" id="edPhotoInput" accept="image/*" multiple style="display:none;">
      <button class="ghost" id="edDocBtn">📄 Import PDF / CSV</button>
      <input type="file" id="edDocInput" accept=".pdf,.csv,.tsv,.txt,application/pdf,text/csv,text/tab-separated-values,text/plain" style="display:none;">
      <button class="ghost" id="edUrlBtn">🔗 Import from menu URL</button>
    </div>
    <div class="ed-row" id="edUrlRow" style="display:none; margin-top:8px;">
      <input class="grow" type="url" id="edUrlInput" placeholder="https://yourrestaurant.com/menu" autocomplete="off">
      <button class="ghost" id="edUrlGo">Fetch</button>
    </div>
    <p class="ed-note" id="edPhotoNote"></p>
  `;

  document.getElementById('edBack').addEventListener('click', () => {
    mgrView = { mode: 'packs' }; renderContentTab(el);
  });

  document.getElementById('edSavePack').addEventListener('click', async () => {
    const title = document.getElementById('edTitle').value.trim();
    if(!title){ edFail(new Error('The pack needs a title.')); return; }
    const levels = p.levels.map((l, i) => Object.assign({}, l, {
      title: (el.querySelector(`[data-lvl-title="${i}"]`).value.trim() || l.title),
      lives: Math.min(9, Math.max(1, parseInt(el.querySelector(`[data-lvl-lives="${i}"]`).value, 10) || l.lives))
    }));
    try {
      await window.Backend.manager.updatePack(p.id, {
        title,
        icon: document.getElementById('edIcon').value.trim() || '📋',
        eyebrow: document.getElementById('edEyebrow').value.trim(),
        tagline: document.getElementById('edTagline').value.trim(),
        levels
      });
      await refetchPacks();
    } catch(e){ edFail(e); }
  });

  document.getElementById('edPublish').addEventListener('click', async () => {
    if(!p.is_published && !p.items.length){
      edFail(new Error('Add at least one item before publishing.')); return;
    }
    try {
      await window.Backend.manager.updatePack(p.id, { is_published: !p.is_published });
      await refetchPacks();
    } catch(e){ edFail(e); }
  });

  document.getElementById('edDeletePack').addEventListener('click', async () => {
    if(!confirm(`Delete "${p.title}" and its ${p.items.length} item(s)? This can't be undone.`)) return;
    try {
      await window.Backend.manager.deletePack(p.id);
      mgrView = { mode: 'packs' };
      await refetchPacks();
    } catch(e){ edFail(e); }
  });

  document.getElementById('edAddItem').addEventListener('click', async () => {
    try {
      const maxPos = p.items.reduce((m, it) => Math.max(m, it.position), -1);
      const rows = await window.Backend.manager.createItems({
        pack_id: p.id, name: 'New Item',
        ingredients: [{ amt: '', item: '' }],
        sections: [{ label: 'Method', text: '' }],
        position: maxPos + 1
      });
      mgrView = { mode: 'item', packId: p.id, itemId: rows[0].id };
      await refetchPacks();
    } catch(e){ edFail(e); }
  });

  document.getElementById('edPhotoBtn').addEventListener('click', () => {
    document.getElementById('edPhotoInput').click();
  });
  document.getElementById('edDocBtn').addEventListener('click', () => {
    document.getElementById('edDocInput').click();
  });
  document.getElementById('edUrlBtn').addEventListener('click', () => {
    const row = document.getElementById('edUrlRow');
    const open = row.style.display === 'none';
    row.style.display = open ? 'flex' : 'none';
    if(open) document.getElementById('edUrlInput').focus();
  });
  const runUrlImport = async () => {
    const input = document.getElementById('edUrlInput');
    const note = document.getElementById('edPhotoNote');
    const go = document.getElementById('edUrlGo');
    let u = (input.value || '').trim();
    if(!u) return;
    if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
    go.disabled = true;
    go.textContent = 'Reading...';
    note.textContent = 'Fetching the page and reading the menu... this can take up to a minute.';
    try {
      const results = await window.Backend.manager.extractRecipes({ url: u });
      if(!results.length){
        note.textContent = 'No recipes or dishes found on that page.';
        return;
      }
      binderPending = results.map(r => Object.assign({ checked: true }, r));
      binderSummary = `1 page read \u00b7 ${results.length} recipe${results.length === 1 ? '' : 's'} found`;
      mgrView = { mode: 'binder', packId: p.id };
      renderContentTab(document.getElementById('mgrContent'));
    } catch(err){
      const n2 = document.getElementById('edPhotoNote');
      if(n2) n2.textContent = err.message;
    } finally {
      go.disabled = false;
      go.textContent = 'Fetch';
    }
  };
  document.getElementById('edUrlGo').addEventListener('click', runUrlImport);
  document.getElementById('edUrlInput').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); runUrlImport(); }
  });
  document.getElementById('edDocInput').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const note = document.getElementById('edPhotoNote');
    const btn = document.getElementById('edDocBtn');
    const name = (file.name || '').toLowerCase();
    if(/\.(xlsx|xls|numbers)$/.test(name)){
      note.textContent = 'Excel files aren\'t supported directly. In your spreadsheet app, use File > Save As > CSV (or export a PDF) and import that.';
      e.target.value = '';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Reading document...';
    note.textContent = 'Reading document... larger menus can take up to a minute.';
    try {
      let payload;
      if(name.endsWith('.pdf') || file.type === 'application/pdf'){
        const b64 = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result).split(',')[1]);
          fr.onerror = () => rej(new Error('Couldn\'t read that file.'));
          fr.readAsDataURL(file);
        });
        payload = { pdf_base64: b64 };
      } else {
        const text = await file.text();
        if(!text.trim()){ throw new Error('That file looks empty.'); }
        payload = { text: text.slice(0, 300000) };
      }
      const results = await window.Backend.manager.extractRecipes(payload);
      if(!results.length){
        note.textContent = 'No recipes or dishes found in that document.';
        return;
      }
      // Documents almost always carry many items: straight to review.
      binderPending = results.map(r => Object.assign({ checked: true }, r));
      binderSummary = `1 document read \u00b7 ${results.length} recipe${results.length === 1 ? '' : 's'} found`;
      mgrView = { mode: 'binder', packId: p.id };
      renderContentTab(document.getElementById('mgrContent'));
    } catch(err){
      const n2 = document.getElementById('edPhotoNote');
      if(n2) n2.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📄 Import PDF / CSV';
      e.target.value = '';
    }
  });
  document.getElementById('edPhotoInput').addEventListener('change', async e => {
    const files = [...(e.target.files || [])];
    if(!files.length) return;
    const note = document.getElementById('edPhotoNote');
    const btn = document.getElementById('edPhotoBtn');
    btn.disabled = true;
    btn.textContent = 'Reading...';
    let done = 0, found = 0, failed = 0;
    const results = [];
    const update = () => {
      note.textContent = files.length === 1
        ? 'Reading photo...'
        : `Reading photo ${Math.min(done + 1, files.length)} of ${files.length} · ${found} recipe${found === 1 ? '' : 's'} found${failed ? ' · ' + failed + ' unreadable' : ''}`;
    };
    update();
    try {
      // Small worker pool: a 20-photo binder reads in parallel threes
      // instead of taking all afternoon.
      const queue = files.slice();
      let fatal = null;
      const worker = async () => {
        while(queue.length && !fatal){
          const f = queue.shift();
          try {
            const { base64, mediaType } = await downscalePhoto(f);
            const items = await window.Backend.manager.extractRecipes(base64, mediaType);
            if(items.length){ results.push(...items); found += items.length; }
            else failed++;
          } catch(err){
            // Config/auth problems abort the run; a single bad photo doesn't.
            if(/isn't set up|Sign in as/.test(err.message)){ fatal = err; return; }
            failed++;
          }
          done++;
          update();
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if(fatal) throw fatal;

      if(!results.length){
        note.textContent = 'No legible recipes found. Try closer, straighter shots in better light.';
        return;
      }

      if(files.length === 1 && results.length === 1){
        // Single snap keeps the fast path: create it and open for review.
        const maxPos = p.items.reduce((m, it) => Math.max(m, it.position), -1);
        const created = await window.Backend.manager.createItems({
          pack_id: p.id, name: results[0].name,
          ingredients: results[0].ingredients,
          sections: results[0].sections.length ? results[0].sections : [{ label: 'Method', text: '' }],
          position: maxPos + 1
        });
        mgrView = { mode: 'item', packId: p.id, itemId: created[0].id };
        await refetchPacks();
        return;
      }

      // Binder mode: stage everything for review before anything is saved.
      binderPending = results.map(r => Object.assign({ checked: true }, r));
      binderSummary = `${files.length} photos read · ${found} recipe${found === 1 ? '' : 's'} found` +
        (failed ? ` · ${failed} photo${failed === 1 ? '' : 's'} unreadable` : '');
      mgrView = { mode: 'binder', packId: p.id };
      renderContentTab(document.getElementById('mgrContent'));
    } catch(err){
      const n2 = document.getElementById('edPhotoNote');
      if(n2) n2.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📷 Add from photos';
      e.target.value = '';
    }
  });

  el.querySelectorAll('[data-open-item]').forEach(s => s.addEventListener('click', () => {
    mgrView = { mode: 'item', packId: p.id, itemId: s.dataset.openItem };
    renderContentTab(el);
  }));

  el.querySelectorAll('[data-del-item]').forEach(b => b.addEventListener('click', async () => {
    const it = p.items.find(x => x.id === b.dataset.delItem);
    if(!confirm(`Delete "${it.name}"?`)) return;
    try {
      await window.Backend.manager.deleteItem(it.id);
      await refetchPacks();
    } catch(e){ edFail(e); }
  }));

  const swap = async (i, j) => {
    const a = p.items[i], b = p.items[j];
    try {
      await window.Backend.manager.updateItem(a.id, { position: b.position });
      await window.Backend.manager.updateItem(b.id, { position: a.position });
      await refetchPacks();
    } catch(e){ edFail(e); }
  };
  el.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.up, 10); swap(i, i - 1);
  }));
  el.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.down, 10); swap(i, i + 1);
  }));
}

function renderItemEditor(el){
  const p = mgrPacks.find(x => x.id === mgrView.packId);
  const it = p && p.items.find(x => x.id === mgrView.itemId);
  if(!it){ mgrView = { mode: p ? 'pack' : 'packs', packId: p && p.id }; return renderContentTab(el); }

  const ingRow = g => `
    <div class="ed-row">
      <input class="mgr-input amt" value="${esc(g.amt)}" placeholder="2 oz." aria-label="Amount">
      <input class="mgr-input grow ing" value="${esc(g.item)}" placeholder="Ingredient" aria-label="Ingredient">
      <button class="ed-x" data-remove-row aria-label="Remove row">✕</button>
    </div>`;
  const secRow = s => `
    <div class="ed-row">
      <input class="mgr-input lbl" style="flex:0 0 130px;" value="${esc(s.label)}" placeholder="Method" aria-label="Section label">
      <textarea class="mgr-input grow txt" aria-label="Section text">${esc(s.text)}</textarea>
      <button class="ed-x" data-remove-row aria-label="Remove row">✕</button>
    </div>`;

  el.innerHTML = `
    <button class="ghost" id="edBackItem" style="margin-bottom:4px;">← ${esc(p.title)}</button>
    <p class="ed-label">Item name</p>
    <input class="mgr-input" id="edItemName" maxlength="80" value="${esc(it.name)}">
    <p class="ed-label">Ingredients — amount + name; the quiz blanks these out</p>
    <div id="edIngRows">${it.ingredients.map(ingRow).join('')}</div>
    <div class="ed-actions" style="margin-top:6px;"><button class="ghost" id="edAddIng">+ Ingredient</button></div>
    <p class="ed-label">Card sections — extra info shown on the recipe card</p>
    <div id="edSecRows">${it.sections.map(secRow).join('')}</div>
    <div class="ed-actions" style="margin-top:6px;"><button class="ghost" id="edAddSec">+ Section</button></div>
    <div class="ed-actions">
      <button class="primary" id="edSaveItem">Save Item</button>
      <button class="ghost" id="edDeleteItem" style="border-color:var(--bad); color:var(--bad);">Delete Item</button>
    </div>
    <p class="ed-note" id="edSavedNote"></p>
    <p class="mgr-err" id="edErr"></p>
  `;

  const addRow = (containerId, html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.getElementById(containerId).appendChild(div.firstElementChild);
  };
  document.getElementById('edAddIng').addEventListener('click', () => addRow('edIngRows', ingRow({ amt: '', item: '' })));
  document.getElementById('edAddSec').addEventListener('click', () => addRow('edSecRows', secRow({ label: '', text: '' })));
  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-row]');
    if(btn) btn.closest('.ed-row').remove();
  });

  document.getElementById('edBackItem').addEventListener('click', () => {
    mgrView = { mode: 'pack', packId: p.id }; renderContentTab(el);
  });

  document.getElementById('edSaveItem').addEventListener('click', async () => {
    const name = document.getElementById('edItemName').value.trim();
    const ingredients = [...document.querySelectorAll('#edIngRows .ed-row')].map(r => ({
      amt: r.querySelector('.amt').value.trim(),
      item: r.querySelector('.ing').value.trim()
    })).filter(g => g.amt && g.item);
    const sections = [...document.querySelectorAll('#edSecRows .ed-row')].map(r => ({
      label: r.querySelector('.lbl').value.trim(),
      text: r.querySelector('.txt').value.trim()
    })).filter(s => s.label && s.text);
    if(!name){ edFail(new Error('The item needs a name.')); return; }
    if(!ingredients.length){ edFail(new Error('Add at least one ingredient with both an amount and a name.')); return; }
    try {
      await window.Backend.manager.updateItem(it.id, { name, ingredients, sections });
      mgrPacks = await window.Backend.manager.packs(mgrRid);
      renderContentTab(el);
      const note = document.getElementById('edSavedNote');
      if(note) note.textContent = 'Saved.';
    } catch(e){ edFail(e); }
  });

  document.getElementById('edDeleteItem').addEventListener('click', async () => {
    if(!confirm(`Delete "${it.name}"?`)) return;
    try {
      await window.Backend.manager.deleteItem(it.id);
      mgrView = { mode: 'pack', packId: p.id };
      await refetchPacks();
    } catch(e){ edFail(e); }
  });
}

function packLabel(r){
  const p = window.PACKS.find(p => p.id === r.pack_id);
  return p ? p.title : '';
}

function renderPlayersTab(){
  if(!Array.isArray(mgrData) || mgrData.length === 0) return `<div class="mgr-empty">No sessions recorded yet.<br>Players show up here after completing a level.</div>`;
  const players = {};
  mgrData.forEach(r => {
    if(!players[r.player_name]) players[r.player_name] = { sessions:[], scores:[] };
    players[r.player_name].sessions.push(r);
    players[r.player_name].scores.push(r.score);
  });
  const totalSessions = mgrData.length;
  const totalPlayers = Object.keys(players).length;
  const avgScore = Math.round(mgrData.reduce((s,r)=>s+r.score,0)/mgrData.length);
  let html = `
    <div class="mgr-summary">
      <div class="mgr-stat"><div class="val">${totalPlayers}</div><div class="lbl">Players</div></div>
      <div class="mgr-stat"><div class="val">${totalSessions}</div><div class="lbl">Sessions</div></div>
      <div class="mgr-stat"><div class="val">${avgScore}</div><div class="lbl">Avg Score</div></div>
      <div class="mgr-stat"><div class="val">${Math.max(...mgrData.map(r=>r.score))}</div><div class="lbl">Top Score</div></div>
    </div>`;
  Object.entries(players).sort((a,b)=>b[1].sessions.length-a[1].sessions.length).forEach(([name,data]) => {
    const best = Math.max(...data.scores);
    const avg = Math.round(data.scores.reduce((a,b)=>a+b,0)/data.scores.length);
    const last = new Date(data.sessions[0].created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    html += `<div class="player-card" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
      <p class="player-name">${esc(name)}</p>
      <div class="player-meta">
        <span>📋 ${data.sessions.length} sessions</span>
        <span>🏆 Best: ${best}</span>
        <span>📊 Avg: ${avg}</span>
        <span>🕐 ${last}</span>
      </div>
    </div>
    <div style="display:none; margin-bottom:10px; padding:0 4px;">
      ${data.sessions.slice(0,10).map(r=>`
        <div class="detail-row">
          <div class="dr-level">${esc(r.level_title)}${r.pack_id ? ' <span style="opacity:0.6;">· ' + esc(packLabel(r)) + '</span>' : ''}</div>
          <div class="dr-meta">Score: ${esc(r.score)} &nbsp;·&nbsp; Lives left: ${esc(r.lives_remaining)} &nbsp;·&nbsp; ${new Date(r.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div>
        </div>`).join('')}
    </div>`;
  });
  return html;
}

function renderRecentTab(){
  if(!Array.isArray(mgrData) || mgrData.length === 0) return `<div class="mgr-empty">No sessions yet.</div>`;
  return mgrData.slice(0,30).map(r => `
    <div class="detail-row">
      <div class="dr-level" style="display:flex;justify-content:space-between;"><span>${esc(r.player_name)}</span><span>${esc(r.score)} pts</span></div>
      <div class="dr-meta">${esc(r.level_title)}${r.pack_id ? ' · ' + esc(packLabel(r)) : ''} &nbsp;·&nbsp; Lives left: ${esc(r.lives_remaining)} &nbsp;·&nbsp; ${new Date(r.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div>
    </div>`).join('');
}

function renderSetupTab(){
  const m = mgrMemberships.find(m => m.restaurant.id === mgrRid);
  let planLine = '';
  if(m){
    if(m.restaurant.plan === 'active') planLine = 'Subscription active.';
    else if(m.restaurant.plan === 'suspended') planLine = 'Account paused.';
    else {
      const left = trialDaysLeft(m.restaurant);
      planLine = left > 0 ? `Free trial, ${left} day${left === 1 ? '' : 's'} left.` : 'Trial ended.';
    }
  }
  return `<div class="mgr-setup">
    <strong>Signed in</strong>
    ${esc(window.Backend.manager.email())} · ${esc(m ? m.role : '')} of ${esc(m ? m.restaurant.name : '')}<br><br>
    <strong>Plan</strong>
    ${esc(planLine)}<br><br>
    <strong>Staff join code</strong>
    Staff enter this code (with their first name) to start training:
    <code style="font-size:15px; letter-spacing:0.15em;">${esc(m ? m.restaurant.join_code : '')}</code><br><br>
    <strong>Or let them scan this</strong>
    Print it, tape it in the break room. Scanning opens the app with the
    code already filled in.
    ${joinQrHtml(m ? m.restaurant.join_code : '')}
    <strong>Connection</strong>
    ${esc(window.APP_CONFIG.SUPABASE_URL)}
  </div>`;
}

// QR of the join URL (js/vendor/qrcode-generator.js, MIT). Rendered on a
// white card because scanners want dark modules on a light ground.
function joinQrHtml(code){
  if(!code || typeof qrcode !== 'function') return '<br><br>';
  try {
    const url = new URL(location.pathname, location.origin);
    url.search = '?join=' + encodeURIComponent(code);
    const qr = qrcode(0, 'M');
    qr.addData(url.toString());
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    return `<div style="background:#fff; border-radius:10px; padding:10px; width:180px; margin:12px 0 4px;">
      <div style="width:160px; height:160px;">${svg.replace('<svg ', '<svg style="width:100%;height:100%;" ')}</div>
    </div>
    <span style="font-size:11px; opacity:0.7; word-break:break-all;">${esc(url.toString())}</span><br><br>`;
  } catch(e){ return '<br><br>'; }
}

/* ======================= INIT ======================= */
// Boot is driven by js/loader.js: it handles the join flow, fills
// window.PACKS from the database, then hands over here.
function appReady(playerName, restaurantName){
  const drill = buildDrillPack(window.PACKS);
  if(drill) window.PACKS.push(drill);
  state.preview = false;
  document.getElementById('mgrTrigger').textContent = 'Manager sign-in';
  state.playerName = playerName;
  document.getElementById('packsSub').textContent =
    restaurantName + ' · Signed in as ' + playerName;
  showScreen('screenPacks');
  renderPacks();
}
