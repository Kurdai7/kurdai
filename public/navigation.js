// Stable public navigation: keep the original page DOM and controls in place.
// The previous dynamic page-reparenting script could leave the page visually empty
// when a module failed midway through initialization.
const labels = {
  studio: ['ستۆدیۆ', 'Studio'],
  preview: ['پێشبینین', 'Preview'],
  account: ['ئەکاونت', 'Account']
};
const links = [...document.querySelectorAll('.studio-nav a')];
function updateNavigationLanguage() {
  const english = document.documentElement.lang === 'en';
  for (const link of links) {
    const key = link.getAttribute('href')?.slice(1);
    if (labels[key]) link.textContent = labels[key][english ? 1 : 0];
  }
  const nav = document.querySelector('.studio-nav');
  if (nav) nav.setAttribute('aria-label', english ? 'Main navigation' : 'بەشەکانی ماڵپەڕ');
}
function navigateToSection(event) {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const target = document.getElementById(link.getAttribute('href').slice(1));
  if (!target) return;
  event.preventDefault();
  target.hidden = false;
  target.style.removeProperty('display');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', link.getAttribute('href'));
}
document.querySelector('.studio-nav')?.addEventListener('click', navigateToSection);
document.querySelector('#languageToggle')?.addEventListener('click', () => {
  // app.js owns the actual language toggle; this listener only refreshes labels
  // after the document language has changed.
  queueMicrotask(updateNavigationLanguage);
});
new MutationObserver(updateNavigationLanguage).observe(document.documentElement, {
  attributes: true, attributeFilter: ['lang']
});
updateNavigationLanguage();
