import { nav, GITHUB_URL } from '../site.js';
import { esc } from '../ui/format.js';

export const FORFAITS = [
  {
    name: 'Forfait Crevard',
    price: '0 €',
    period: '/mois',
    desc: 'Un forfait pour les crevards que vous êtes. Ne vous inquiétez pas. On est tous pareils.',
    features: ['Gratuit', 'Discutez en local','Clodo vous insulte de temps à autres'],
    cta: 'Par défaut',
    featured: false,
  },
  {
    name: 'Forfait CAC40',
    price: '100 €',
    period: '/mois',
    desc: 'Bonjour à toi jeune entrepreneur ! Tu veux gagner un mill- bref, tu veux propulser ta startup avec l’IA ? Alors tu es au bon endroit : Clodo a tous les atouts pour te séduire ! ',
    features: ['Français', 'Local', 'Pigeonophile', 'Propulse ta startup avec l\'IA'],
    cta: 'Choisir',
    featured: true,
    badge: 'Populaire',
  },
  {
    name: 'Forfait Prince du Quatar',
    price: '1 000 000 €',
    period: '/an',
    desc: 'Vous êtes richissime de naissance, sans jamais avoir travaillé ? Parfait ! Clodo est fait pour vous !',
    features: ['Accès prioritaire pendant les périodes de forte affluence', 'Clodo vous complimente', 'Clodo vous loue une escort chaque mois', 'Clodo révèle des informations compromettantes sur vos opposants politiques', 'À la fin de l\'abonnement, vous recevez en cadeau un club de foot'],
    cta: 'Nous contacter',
    featured: false,
  },
];

function planCard(p) {
  const badge = p.badge ? `<span class="plan-badge">${esc(p.badge)}</span>` : '';
  const features = p.features.map((f) => `<li>${esc(f)}</li>`).join('');
  return `
    <div class="plan-card${p.featured ? ' featured' : ''}">
      ${badge}
      <h3 class="plan-name">${esc(p.name)}</h3>
      <div class="plan-price"><span class="plan-amount">${esc(p.price)}</span><span class="plan-period">${esc(p.period)}</span></div>
      <p class="plan-desc">${esc(p.desc)}</p>
      <ul class="plan-features">${features}</ul>
      <a
        class="btn ${p.featured ? 'btn-primary' : 'btn-ghost'} plan-cta"
        href="https://www.youtube.com/watch?v=xvFZjo5PgG0"
        target="_blank"
        rel="noopener noreferrer"
      >
      ${esc(p.cta)}
      </a>    
    </div>`;
}

export function renderForfaits() {
  return `
    ${nav()}
    <main class="page">
      <div class="page-hero">
        <h1 class="page-title">Nos <em>forfaits</em>.</h1>
        <p class="page-sub">Choisissez la formule qui vous convient. Sans engagement (ni remboursements) — de toute façon, tout se passe chez vous.</p>
      </div>
      <div class="plans-grid">
        ${FORFAITS.map(planCard).join('')}
      </div>
      <footer class="home-footer">
        <span>Clodo — l'ia du futur.</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener">${esc(GITHUB_URL)}</a>
      </footer>
    </main>`;
}
