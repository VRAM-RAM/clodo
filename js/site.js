// Éléments partagés par toutes les pages : URL du dépôt et barre de navigation.

export const GITHUB_URL = 'https://github.com/VRAM-RAM/clodo';

// Liens de navigation (label + route). L'état « actif » est calculé d'après le hash.
const LINKS = [
  { label: 'Home', href: '#/' },
  { label: 'Témoignages', href: '#/temoignages' },
  { label: 'Forfaits', href: '#/forfaits' },
  { label: 'Chat', href: '#/chat' },
  { label: 'Classements', href: '#/bench'},
];

function isActive(href, hash) {
  if (href === '#/') return hash === '#/' || hash === '';
  return hash === href || hash.startsWith(href + '/');
}

export function nav() {
  const hash = location.hash || '#/';
  const linksHtml = LINKS.map((l) => {
    const active = isActive(l.href, hash) ? ' active' : '';
    return `<a class="nav-link${active}" href="${l.href}">${l.label}</a>`;
  }).join('');
  return `
    <header class="nav">
      <div class="nav-left">
        <a class="nav-logo" href="#/">
          <img src="./assets/logo.svg" alt="Clodo logo">
          <span class="nav-brand">Clodo</span>
        </a>
      </div>
      <div class="nav-right">
        ${linksHtml}
        <a class="nav-link" href="${GITHUB_URL}" target="_blank" rel="noopener">GitHub</a>
      </div>
    </header>`;
}
