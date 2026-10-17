import { nav, GITHUB_URL } from '../site.js';
import { esc } from '../app.js';

export function renderFirstFalseSourcePage() {
  return `
    ${nav()}
    <main class="page">
      <div class="page-hero">
        <div class="hero-badge">Nos sources</div>
        <h1 class="page-title">Pour voir nos sources, cliquez sur le lien ci-dessous</h1>
        <p class="page-sub">Issues d'études <em>indépendantes</em>.</p>
      </div>
      <div class="link">
        <a href="#/source" style="font-size: 4px;">Cliquez ici</a>
      </div>
      <footer class="home-footer">
        <span>Clodo — l'ia du futur</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener">${esc(GITHUB_URL)}</a>
      </footer>
    </main>`;
}

export function renderSecondFalseSourcePage() {
    return `
    ${nav()}
    <main class="page">
      <div class="page-hero">
        <div class="hero-badge">Nos sources</div>
        <h1 class="page-title"></h1>
        <p class="page-sub">Veuillez continuer en appuyant sur le <em>lien</em></p>
      </div>
      <div class="link">
        <a href="#/home" style="font-size: 300px;">Cliquez ici</a>
      </div>
      <footer class="home-footer">
        <span>Clodo — l'ia du futur</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener">${esc(GITHUB_URL)}</a>
      </footer>
    </main>`;
}