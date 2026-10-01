/* ============================================================
   SERVICE WORKER
   Keeps a copy of the app itself on the phone, so Seasoned opens with
   no signal (the walk-in, the basement). Only the app's own files are
   handled. Training content is saved by the page (js/loader.js keeps
   the last packs, board and assignments in localStorage), and calls to
   Supabase never pass through here.

   app.html: the network first, the saved copy if the network is down
   or slower than NAV_TIMEOUT_MS. A fresh app.html is adopted only after
   every file it references is saved, so the saved shell always matches
   saved files; older ?v= versions are dropped at that point.
   Other app files: the saved copy first, the network on a miss. Their
   ?v= query changes with every release, so a new version is a new URL.

   Bump VERSION only when this file's logic, or an unversioned file
   (fonts, icons, manifest), changes. Releases don't need it.
   ============================================================ */
const VERSION = 'seasoned-app-v1';
const NAV_TIMEOUT_MS = 3000;
const SCOPE = new URL(self.registration.scope);
const SHELL = new URL('app.html', SCOPE).href;
// Files the app needs that app.html doesn't name (the CSS loads the fonts).
const EXTRAS = ['manifest.json', 'fonts/jost.woff2', 'fonts/playfair-display.woff2',
  'icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
// What counts as the app: app.html and its own folders. The landing
// page, the guide and everything else go straight to the network.
const APP_FILE = /^(?:app\.html|manifest\.json|(?:css|js|fonts|icons)\/.+)$/;

function appPath(url){
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname)
    ? url.pathname.slice(SCOPE.pathname.length) : null;
}

// Local files app.html loads (scripts, stylesheets, icons, manifest).
function shellFiles(html){
  const out = new Set(EXTRAS.map(p => new URL(p, SCOPE).href));
  for(const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)){
    const u = new URL(m[1], SCOPE);
    if(APP_FILE.test(appPath(u) || '')) out.add(u.href);
  }
  return [...out];
}

async function adoptShell(res){
  const cache = await caches.open(VERSION);
  const files = shellFiles(await res.clone().text());
  for(const f of files){
    if(!(await cache.match(f))) await cache.add(f);   // throws offline: keep the old shell
  }
  await cache.put(SHELL, res);
  const keep = new Set(files);
  for(const req of await cache.keys()){
    if(new URL(req.url).search && !keep.has(req.url)) await cache.delete(req);
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const res = await fetch(SHELL, { cache: 'no-cache' });
    if(res.ok) await adoptShell(res);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for(const k of await caches.keys()){
      if(k.startsWith('seasoned-') && k !== VERSION) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const path = appPath(url);
  if(path === null || !APP_FILE.test(path)) return;

  if(req.mode === 'navigate'){
    if(path !== 'app.html') return;
    const network = fetch(req).then(res => ({ res, copy: res.ok ? res.clone() : null }));
    e.waitUntil(network.then(n => n.copy && adoptShell(n.copy)).catch(() => {}));
    e.respondWith((async () => {
      const saved = await caches.match(SHELL);
      if(!saved) return (await network).res;          // first visit: nothing saved yet
      const fresh = network.then(n => n.res.ok ? n.res : saved, () => saved);
      return Promise.race([fresh, sleep(NAV_TIMEOUT_MS).then(() => saved)]);
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if(hit) return hit;
    const res = await fetch(req);
    if(res.ok && res.type === 'basic') e.waitUntil(cache.put(req, res.clone()));
    return res;
  })());
});
