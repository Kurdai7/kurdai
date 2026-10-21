// Separate views without replacing controls, sessions or request state.
const main = document.querySelector('main');
const labels = {
  home: ['سەرەکی', 'Home'], studio: ['دروستکردنی ڤیدیۆ', 'Create video'],
  videos: ['ڤیدیۆکانم', 'My videos'], credits: ['کرێدیت و پاکێجەکان', 'Credits and packs'],
  account: ['ئەکاونتم', 'My account']
};
const pages = new Map();
for (const key of Object.keys(labels)) {
  const page = document.createElement('section');
  page.className = 'app-page'; page.dataset.page = key; page.tabIndex = -1;
  main.append(page); pages.set(key, page);
}
const move = (key, selector) => { const node = document.querySelector(selector); if (node) pages.get(key).append(node); };
move('home', '.hero'); move('home', '.features');
move('videos', '#preview');
move('studio', '#studio'); move('studio', '#longPanel');
move('account', '#account'); move('credits', '#billingPanel');
const billingHelp = document.createElement('p'); billingHelp.className = 'credits-help note';
pages.get('credits').append(billingHelp);
const nav = document.querySelector('.studio-nav'); nav.replaceChildren();
const cards = document.createElement('div'); cards.className = 'home-shortcuts';
pages.get('home').querySelector('.hero').after(cards);
const links = [];
function link(key, parent, card = false) {
  const a = document.createElement('a'); a.href = '#' + key;
  a.dataset.destination = key; if (card) a.className = 'home-shortcut';
  parent.append(a); links.push(a);
}
for (const key of Object.keys(labels)) link(key, nav);
for (const key of ['studio', 'videos', 'credits', 'account']) link(key, cards, true);
function language() {
  const en = document.documentElement.lang === 'en';
  for (const a of links) a.textContent = labels[a.dataset.destination][en ? 1 : 0];
  nav.setAttribute('aria-label', en ? 'Main navigation' : 'بەشەکانی ماڵپەڕ');
  for (const [key, page] of pages) page.setAttribute('aria-label', labels[key][en ? 1 : 0]);
  billingHelp.textContent = en ? 'Log in to view your balance and available packs. If packs are unavailable, checkout is not enabled for this account.' : 'بۆ بینینی کرێدیت و پاکێجە بەردەستەکان بچۆ ژوورەوە. ئەگەر پاکێجەکان دەرنەکەوتن، پارەدان بۆ ئەم ئەکاونتە چالاک نییە.';
}
function route(focus = false) {
  const hash = location.hash.slice(1);
  const key = hash === 'preview' ? 'videos' : pages.has(hash) ? hash : 'home';
  for (const [name, page] of pages) page.hidden = name !== key;
  for (const a of links) { if (a.dataset.destination === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  if (focus) { pages.get(key).focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
}
window.addEventListener('hashchange', () => route(true));
document.querySelector('#extendResult').addEventListener('click', () => { location.hash = 'studio'; });
new MutationObserver(() => {
  if (!document.querySelector('#resultVideo').hidden) location.hash = 'videos';
}).observe(document.querySelector('#resultVideo'), { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(language).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
// Reveal source selection when the user chooses an extension or frame workflow.
document.querySelector('#videoMode').addEventListener('change', () => {
  if (document.querySelector('#videoMode').value !== 'new') document.querySelector('#sourceFields').closest('details').open = true;
});
language(); route();
