/* ============================================================
   LOADER
   Owns every conversation with Supabase: sessions, the join-code
   flow, fetching packs, writing results (with an offline retry
   queue), and manager sign-in. The engine (js/app.js) never
   touches the network; it reads window.PACKS and calls
   window.Backend.

   Two independent session slots:
     trainee — anonymous session created by the join flow
     manager — email/password session for dashboard access
   A manager signing in on a trainee's device must not disturb
   the trainee session, so they never share storage.
   ============================================================ */

(function(){
const CFG = window.APP_CONFIG;
const LS = {
  trainee: 'ccq_session',
  manager: 'ccq_mgr_session',
  restaurant: 'ccq_restaurant',
  name: 'ccq_player_name',
  cache: 'ccq_packs_cache',
  queue: 'ccq_result_queue'
};

function lsLoad(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
function lsSave(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function lsDrop(k){ try { localStorage.removeItem(k); } catch(e){} }

const sessions = {
  trainee: lsLoad(LS.trainee),
  manager: lsLoad(LS.manager)
};
let restaurant = lsLoad(LS.restaurant);
let queue = lsLoad(LS.queue) || [];
let flushing = false;

/* ---------------- auth ---------------- */

async function authPost(path, body){
  const res = await fetch(CFG.SUPABASE_URL + path, {
    method: 'POST',
    headers: { 'apikey': CFG.SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok){
    const err = new Error(data.msg || data.error_description || data.message || ('auth error ' + res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

function setSession(slot, d, extra){
  sessions[slot] = Object.assign({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    user_id: (d.user && d.user.id) || (sessions[slot] && sessions[slot].user_id),
    expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600)
  }, (sessions[slot] && { email: sessions[slot].email }) || {}, extra || {});
  lsSave(LS[slot], sessions[slot]);
}

// Anonymous sign-in: POST /signup with an empty body (requires the
// "Anonymous sign-ins" toggle in the Supabase dashboard).
async function signInAnon(){ setSession('trainee', await authPost('/auth/v1/signup', {})); }

async function refreshSession(slot){
  try {
    setSession(slot, await authPost('/auth/v1/token?grant_type=refresh_token',
      { refresh_token: sessions[slot].refresh_token }));
  } catch(e){
    if(slot === 'manager'){ sessions.manager = null; lsDrop(LS.manager); }
    throw e;
  }
}

async function ensureFresh(slot){
  const s = sessions[slot];
  if(s && s.expires_at - 60 < Math.floor(Date.now() / 1000)){
    await refreshSession(slot);
  }
}

/* ---------------- REST ---------------- */

async function rest(slot, method, path, body, extraHeaders){
  await ensureFresh(slot).catch(() => {});   // a dead refresh surfaces as 401 below
  const doFetch = () => fetch(CFG.SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: Object.assign(
      { 'apikey': CFG.SUPABASE_KEY, 'Content-Type': 'application/json' },
      sessions[slot] ? { 'Authorization': 'Bearer ' + sessions[slot].access_token } : {},
      extraHeaders || {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });
  let res = await doFetch();
  if(res.status === 401 && sessions[slot]){
    await refreshSession(slot);              // throws if the session is truly dead
    res = await doFetch();
  }
  return res;
}

/* ---------------- join flow ---------------- */

async function joinRestaurant(code, name){
  if(!sessions.trainee) await signInAnon();
  const res = await rest('trainee', 'POST', 'rpc/join_restaurant', { p_code: code, p_name: name });
  const data = await res.json().catch(() => null);
  if(!res.ok){
    const msg = data && data.message;
    throw new Error(msg === 'invalid join code'
      ? 'That code didn\'t match a restaurant. Check it with your manager.'
      : msg === 'training paused'
      ? 'Training is paused for this restaurant right now. Ask your manager.'
      : (msg || 'Joining failed. Try again.'));
  }
  const row = Array.isArray(data) ? data[0] : data;
  restaurant = { id: row.restaurant_id, name: row.restaurant_name };
  lsSave(LS.restaurant, restaurant);
  lsSave(LS.name, name);
  lsDrop(LS.cache);                          // never show a previous restaurant's cache
  return restaurant;
}

/* ---------------- packs ---------------- */

async function fetchPacks(){
  const res = await rest('trainee', 'GET',
    'packs?select=id,icon,eyebrow,tagline,title,levels,items(name,ingredients,sections,position)' +
    '&order=position.asc&items.order=position.asc');
  if(!res.ok) throw new Error('packs fetch failed: ' + res.status);
  const rows = await res.json();
  return rows.map(p => ({
    id: p.id,
    icon: p.icon || '📋',
    eyebrow: p.eyebrow || '',
    tagline: p.tagline || '',
    title: p.title,
    levels: p.levels,
    items: (p.items || [])
      .sort((a, b) => a.position - b.position)
      .map(i => ({ name: i.name, ingredients: i.ingredients, sections: i.sections }))
  }));
}

/* ---------------- results queue ---------------- */

async function flushQueue(){
  if(flushing) return;
  flushing = true;
  try {
    while(queue.length){
      const res = await rest('trainee', 'POST', 'results', queue[0], { 'Prefer': 'return=minimal' });
      if(res.ok){
        queue.shift(); lsSave(LS.queue, queue);
      } else if(res.status >= 400 && res.status < 500 && res.status !== 401){
        // Policy or validation rejection: retrying will never succeed.
        console.warn('result dropped by server:', res.status);
        queue.shift(); lsSave(LS.queue, queue);
      } else {
        break;                               // offline / server error / dead session: retry next launch
      }
    }
  } catch(e){ /* offline; queue persists */ }
  finally { flushing = false; }
}

/* ---------------- surface for the engine ---------------- */

window.Backend = {
  saveResult(row){
    queue.push(Object.assign({
      restaurant_id: restaurant.id,
      trainee_user_id: sessions.trainee.user_id
    }, row));
    lsSave(LS.queue, queue);
    flushQueue();
  },
  restaurantName(){ return restaurant ? restaurant.name : ''; },
  hasTraineeSession(){ return !!(sessions.trainee && restaurant); },
  reset(){                                   // leave restaurant: forget everything on this device
    Object.values(LS).forEach(lsDrop);
    location.reload();
  },

  manager: {
    isSignedIn(){ return !!sessions.manager; },
    email(){ return sessions.manager ? sessions.manager.email : ''; },

    async signIn(email, password){
      let d;
      try {
        d = await authPost('/auth/v1/token?grant_type=password', { email, password });
      } catch(e){
        throw new Error(e.status === 400
          ? 'Email or password didn\'t match.'
          : 'Sign-in failed. Check your connection and try again.');
      }
      setSession('manager', d, { email });
      // May be empty: a fresh account names its restaurant on first
      // sign-in (create_restaurant RPC via createRestaurant below).
      return this.memberships();
    },

    // Create the account. With email confirmation on (production) no
    // session comes back until they confirm; the app tells them to
    // check their inbox and sign in after.
    async signUp(email, password){
      let d;
      try {
        d = await authPost('/auth/v1/signup', { email, password });
      } catch(e){
        throw new Error(/already|registered/i.test(e.message)
          ? 'That email already has an account. Sign in instead.'
          : (e.message || 'Sign-up failed. Try again.'));
      }
      if(d.access_token){
        setSession('manager', d, { email });
        return { needsConfirm: false };
      }
      return { needsConfirm: true };
    },

    async createRestaurant(name){
      const res = await rest('manager', 'POST', 'rpc/create_restaurant', { p_name: name });
      const data = await res.json().catch(() => null);
      if(!res.ok){
        throw new Error((data && data.message) || 'Couldn\'t create the restaurant. Try again.');
      }
      return Array.isArray(data) ? data[0] : data;
    },

    // "Forgot password": Supabase emails a recovery link that lands back
    // on this app with tokens in the URL hash (handled at boot below).
    async requestPasswordReset(email){
      const res = await fetch(CFG.SUPABASE_URL + '/auth/v1/recover?redirect_to=' +
        encodeURIComponent(location.origin + location.pathname), {
        method: 'POST',
        headers: { 'apikey': CFG.SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if(res.status === 429){
        throw new Error('Too many reset requests. Wait a few minutes and try again.');
      }
      if(!res.ok && res.status !== 200){
        const d = await res.json().catch(() => ({}));
        throw new Error(d.msg || 'Couldn\'t send the reset email. Check the address and try again.');
      }
    },

    async completePasswordReset(newPassword){
      const rec = window.__recovery;
      if(!rec) throw new Error('This reset link has expired. Request a new one from the sign-in screen.');
      const res = await fetch(CFG.SUPABASE_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: {
          'apikey': CFG.SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + rec.access_token
        },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        throw new Error(/weak|short|length/i.test(data.msg || '')
          ? 'That password is too weak. Use at least 8 characters.'
          : (data.msg || 'Couldn\'t set the new password. The link may have expired; request a new one.'));
      }
      // The recovery session becomes the signed-in manager session.
      setSession('manager',
        { access_token: rec.access_token, refresh_token: rec.refresh_token,
          expires_in: rec.expires_in, user: { id: data.id } },
        { email: data.email });
      window.__recovery = null;
      return data.email;
    },

    signOut(){
      const s = sessions.manager;
      sessions.manager = null;
      lsDrop(LS.manager);
      if(s){                                 // best-effort server-side revoke
        fetch(CFG.SUPABASE_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: { 'apikey': CFG.SUPABASE_KEY, 'Authorization': 'Bearer ' + s.access_token }
        }).catch(() => {});
      }
    },

    // [{role, restaurant: {id, name, join_code, plan, created_at}}]
    async memberships(){
      const res = await rest('manager', 'GET',
        'memberships?select=role,restaurants(id,name,join_code,plan,created_at)');
      if(!res.ok) throw new Error('memberships fetch failed: ' + res.status);
      return (await res.json())
        .filter(m => m.restaurants)
        .map(m => ({ role: m.role, restaurant: m.restaurants }));
    },

    async results(rid){
      try {
        const res = await rest('manager', 'GET',
          'results?restaurant_id=eq.' + encodeURIComponent(rid) +
          '&select=*&order=created_at.desc&limit=500');
        return res.ok ? await res.json() : null;
      } catch(e){ return null; }
    },

    // Photo -> structured items via the extract-recipe edge function
    // (supabase/functions/extract-recipe). The AI key lives server-side.
    async extractRecipes(imageBase64, mediaType){
      await ensureFresh('manager').catch(() => {});
      const res = await fetch(CFG.SUPABASE_URL + '/functions/v1/extract-recipe', {
        method: 'POST',
        headers: {
          'apikey': CFG.SUPABASE_KEY,
          'Authorization': 'Bearer ' + sessions.manager.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_base64: imageBase64, media_type: mediaType })
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        const friendly = {
          not_configured: 'Photo import isn\'t set up yet (the AI key hasn\'t been added).',
          not_authorized: 'Sign in as a manager to import photos.',
          bad_image: 'That file didn\'t look like a photo. Use a JPEG or PNG.',
          too_large: 'That photo is too large. Try again; the app will shrink it.',
          extraction_failed: 'Couldn\'t read that photo. Try better light or a closer shot.'
        };
        throw new Error(friendly[data.error] || 'Photo import failed. Try again.');
      }
      return data.items || [];
    },

    /* ---- content CRUD (RLS scopes everything to the manager's own
       restaurants; see db/schema.sql packs_manager_all / items_manager_all) */

    async packs(rid){
      const res = await rest('manager', 'GET',
        'packs?restaurant_id=eq.' + encodeURIComponent(rid) +
        '&select=id,icon,eyebrow,tagline,title,levels,is_published,position,' +
        'items(id,name,ingredients,sections,position)' +
        '&order=position.asc&items.order=position.asc');
      if(!res.ok) throw new Error('packs fetch failed: ' + res.status);
      const rows = await res.json();
      rows.forEach(p => (p.items = p.items || []).sort((a, b) => a.position - b.position));
      return rows;
    },
    createPack(row){ return this._write('POST', 'packs', row); },
    updatePack(id, patch){ return this._write('PATCH', 'packs?id=eq.' + id, patch); },
    deletePack(id){ return this._write('DELETE', 'packs?id=eq.' + id); },
    createItems(rows){ return this._write('POST', 'items', rows); },  // accepts one object or a bulk array
    updateItem(id, patch){ return this._write('PATCH', 'items?id=eq.' + id, patch); },
    deleteItem(id){ return this._write('DELETE', 'items?id=eq.' + id); },

    async _write(method, path, body){
      const res = await rest('manager', method, path, body, { 'Prefer': 'return=representation' });
      if(!res.ok){
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || ('Save failed (' + res.status + '). Try again.'));
      }
      return res.status === 204 ? null : await res.json().catch(() => null);
    }
  }
};

/* ---------------- join screen ---------------- */

const codeInput = document.getElementById('joinCodeInput');
const nameInput = document.getElementById('joinNameInput');
const joinBtn = document.getElementById('joinBtn');
const joinErr = document.getElementById('joinErr');

function validateJoin(){
  joinBtn.disabled = codeInput.value.trim().length < 4 || nameInput.value.trim().length < 2;
}
codeInput.addEventListener('input', validateJoin);
nameInput.addEventListener('input', validateJoin);
[codeInput, nameInput].forEach(el => el.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !joinBtn.disabled) joinBtn.click();
}));

joinBtn.addEventListener('click', async () => {
  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining...';
  joinErr.textContent = '';
  try {
    await joinRestaurant(codeInput.value.trim().toUpperCase(), nameInput.value.trim());
    await loadContent();
  } catch(e){
    joinErr.textContent = e.message;
  } finally {
    joinBtn.textContent = 'Start Training';
    validateJoin();
  }
});

document.getElementById('switchBtn').addEventListener('click', e => {
  e.preventDefault();
  window.Backend.reset();
});

/* ---------------- boot ---------------- */

async function loadContent(){
  let packs = null, fromCache = false;
  try {
    packs = await fetchPacks();
    lsSave(LS.cache, { restaurantId: restaurant.id, packs });
  } catch(e){
    const c = lsLoad(LS.cache);
    if(c && c.restaurantId === restaurant.id){ packs = c.packs; fromCache = true; }
  }
  if(!packs){
    showScreen('screenJoin');
    joinErr.textContent = 'Can\'t reach the server and nothing is saved on this device yet. Get online once to load your restaurant\'s content.';
    return;
  }
  window.PACKS = packs;
  document.getElementById('offlineNote').style.display = fromCache ? 'block' : 'none';
  appReady(lsLoad(LS.name) || 'Trainee', restaurant.name);
}

(async () => {
  flushQueue();
  if(sessions.trainee && restaurant){ await loadContent(); }
  else { showScreen('screenJoin'); }
  // Landing page CTAs deep-link owners straight into manager sign-up;
  // this must run after boot settles or the content load stomps it.
  const hashParams = new URLSearchParams(location.hash.slice(1));
  if(hashParams.get('type') === 'recovery' && hashParams.get('access_token')){
    // Arrived from a password-reset email: stash the recovery session
    // and open the set-new-password pane.
    window.__recovery = {
      access_token: hashParams.get('access_token'),
      refresh_token: hashParams.get('refresh_token'),
      expires_in: parseInt(hashParams.get('expires_in'), 10) || 3600
    };
    history.replaceState(null, '', location.pathname + location.search);
    openPasswordReset();
  } else if(hashParams.get('error_description')){
    // Expired/used reset link lands here with an error payload.
    history.replaceState(null, '', location.pathname + location.search);
    openManagerMode();
    document.getElementById('mgrLoginErr').textContent =
      'That reset link expired or was already used. Tap "Forgot password?" for a fresh one.';
  } else if(location.hash === '#manager'){
    openManagerMode();
  }
  // QR scans arrive as ?join=CODE: prefill the code so a new trainee
  // only has to type their name. Ignored if this device already joined.
  const joinParam = new URLSearchParams(location.search).get('join');
  if(joinParam && !(sessions.trainee && restaurant)){
    codeInput.value = joinParam.toUpperCase();
    codeInput.dispatchEvent(new Event('input'));
    nameInput.focus();
  }
})();

})();
