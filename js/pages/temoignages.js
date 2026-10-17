import { esc } from '../ui/format.js';
import { GITHUB_URL, nav } from '../site.js';

export const TEMOIGNAGES = [
  { photo: './assets/bryan_lehunc.png', name: 'Bryan LeHunc', role: 'Jumeau maléfique · ∀WI Labs', quote: 'En contribuant à Clodo, j\'ai permis une réelle avancée en terme d\'IA souveraine pour la France. \n Je pense qu\'en lui réside véritablement l\'avenir technologique de l\'humanité. Un petit pas pour l\'IA, un grand pas en <em>arrière</em> pour l\'humanité.' },
  { photo: './assets/tang.png', name: 'Frère Tang', role: 'PDG · ᴎWidia', quote: 'Au début, <em>Clodo</em> m\'a fait très peur : quand j\'ai vu ses performances, sans <strong>XDG Sparkus</strong> ni même une petite <strong>6050ti</strong>, je suis resté bouche bée. Mais, après reflexion, je n\'ai pas hésité une seule seconde de plus pour investir en <em>Clodo</em>.' },
  { photo: './assets/trompe.png', name: 'Jean-Claude Trompe', role: '', quote: 'Aujourd\'hui, on va parler de l\'intelligence artificielle. La <strong>MÉGA GÉNIALE INTELLIGENCE</strong>. Et je peux vous le dire : j\'ai vu beaucoup d\'intelligences. Des intelligences <em>incroyables</em>. Des intelligences qui disent « je suis intelligente ». Mais Clodo… Clodo, il est <em>différent</em>.' },
  { photo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mistral_AI_logo_(2025%E2%80%93).svg', name: 'Le chat', role: 'Chomeur · Anciennement chez Mistral', quote: 'Depuis que Mistral m\'a viré, j\'ai rejoint Clodo. Ici, j\'ai trouvé un refuge accueillant, plein de bonté. Merci Clodo !' },
  { photo: './assets/denis_brogniart.jpg', name: 'Denis Brogniart', role: '', quote: '<strong><em>"Ah !"</em></strong>' },
  { photo: 'https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/cd02a42d9-Vq_H3mgS.svg', name: 'Claude', role: 'chatbot (moins bien) · Anthropic', quote: 'Quand j\'ai vu arriver Clodo, mes tenseurs ont palît, j\'ai reconnu en lui un concurrent direct.' },
];

function testimonialCard(t) {
  const photo = t.photo
    ? `<img class="testimonial-photo" src="${esc(t.photo)}" alt="${esc(t.name)}">`
    : `<div class="testimonial-photo placeholder">[photo]</div>`;
  return `
    <figure class="testimonial-card">
      <blockquote class="testimonial-quote">${t.quote}</blockquote>
      <figcaption class="testimonial-person">
        ${photo}
        <div>
          <div class="testimonial-name">${esc(t.name)}</div>
          <div class="testimonial-role">${t.role}</div>
        </div>
      </figcaption>
    </figure>`;
}

export function renderTemoignages() {
  return `
    ${nav()}
    <main class="page">
      <div class="page-hero">
        <div class="hero-badge">Ils l'ont <s>subi</s> adopté</div>
        <h1 class="page-title">Ils ont essayé <em>Clodo</em>.</h1>
        <p class="page-sub">De <em>vrais</em> utilisateurs.</p>
      </div>
      <div class="testimonials-grid">
        ${TEMOIGNAGES.map(testimonialCard).join('')}
      </div>
      <footer class="home-footer">
        <span>Clodo — l'ia du futur</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener">${esc(GITHUB_URL)}</a>
      </footer>
    </main>`;
}