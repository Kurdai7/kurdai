// Keep navigation native so browser hash links always work, even if another
// application module fails to initialize. Do not reparent or hide page sections.
const labels = {
  studio: ['ستۆدیۆ', 'Studio'],
  preview: ['پێشبینین', 'Preview'],
  account: ['ئەکاونت', 'Account']
};

function updateNavigationLanguage() {
  const english = document.documentElement.lang === 'en';
  for (const link of document.querySelectorAll('.studio-nav a[href^="#"]')) {
    const key = link.getAttribute('href').slice(1);
    if (labels[key]) link.textContent = labels[key][english ? 1 : 0];
  }
  const nav = document.querySelector('.studio-nav');
  if (nav) nav.setAttribute('aria-label', english ? 'Main navigation' : 'بەشەکانی ماڵپەڕ');
}

document.addEventListener('DOMContentLoaded', updateNavigationLanguage);
new MutationObserver(updateNavigationLanguage).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['lang']
});
updateNavigationLanguage();
