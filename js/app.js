import { init } from './wasm.js';
import { mountChat } from './chat.js';
import { preloadModel, modelLine, onModelChange } from './model.js';
import { nav, GITHUB_URL } from './site.js';
import { renderTemoignages, renderForfaits } from './pages.js';

const app = document.getElementById('app');
const boot = document.getElementById('boot');

function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function renderHome(runtime) {
  app.innerHTML = `
    ${nav()}
    <main class="home">
      <img src="./assets/logo.svg" alt="Clodo" class="hero-mark">
      <div class="hero-badge">Interrogez <s>l'avenir</s> vous.</div>
      <h1 class="hero-title">Le futur de l'IA française <em>souveraine</em>.</h1>
      <p class="hero-sub">
        Clodo est un assistant d'<strong>IA</strong> créé en <em>France</em>.
        Il tourne dans <strong>votre</strong> navigateur et <strong>explose</strong> ses concurrents sur tous les aspects !
      </p>
      <div class="hero-model" id="hero-model">${modelLine()}</div>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#/chat">
          Essayez-le !
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d=""/><path d="m13 6 6 6-6 6"/></svg>
        </a>
        <a class="btn btn-ghost" href="#/temoignages">
          Témoignages
            <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"><path d=""/><path d="m13 6 6 6-6 6"/></svg>
        </a>
      </div>

      <div class="hero-features">
        <div class="feature-card">
          <div class="feature-icon"></div>
          <h3 class="feature-title">Français</h3>
          <p class="feature-text">Il est français. Ça suffit non ?</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"></div>
          <h3 class="feature-title">Privé par design</h3>
          <p class="feature-text">Alors que les amerloques et les chintoks vous sucent vos données, avec <em>Clodo</em> elles restent chez vous !</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"></div>
          <h3 class="feature-title">Forfaits honnêtes, sans <em>aucune</em> limite de tokens.</h3>
          <p class="feature-text">Ses forfaits sont véritablement avantageux, ne mettent <strong>aucune</strong> limite de tokens et proposent des fonctionnalités hors du commun.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"></div>
          <h3 class="feature-title">Rapide et performant</h3>
          <p class="feature-text">Clodo est bien plus rapide que tous ses concurrents ! Je vous jure !</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"></div>
          <h3 class="feature-title">Rassurant</h3>
          <p class="feature-text">Il vous fera sentir vraiment, <strong>vraiment</strong> intelligent.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"></div>
          <h3 class="feature-title">Ouvert - totalement</h3>
          <p class="feature-text">Vous en avez marre du privé ? Pas de problèmes ! <em>Clodo</em> est totalement ouvert ! Retrouvez son code source sur GitHub et son modèle sur HuggingFace !</p>
        </div>
      </div>

      <footer class="home-footer">
        <span>Clodo — l'ia du futur.</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener">${esc(GITHUB_URL)}</a>
      </footer>
    </main>`;
}

function route() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/chat')) {
    const id = hash.split('/')[2] || '';
    return mountChat(runtime, app, id);
  }
  if (hash.startsWith('#/temoignages')) {
    app.innerHTML = renderTemoignages();
    return;
  }
  if (hash.startsWith('#/forfaits')) {
    app.innerHTML = renderForfaits();
    return;
  }
  renderHome(runtime);
}

let runtime = null;

async function start() {
  runtime = await init();
  route();
  window.addEventListener('hashchange', route);
  onModelChange(() => {
    const el = document.getElementById('hero-model');
    if (el) el.textContent = modelLine();
  });
  preloadModel(runtime.module);
  requestAnimationFrame(() => boot.classList.add('hidden'));
}

start();