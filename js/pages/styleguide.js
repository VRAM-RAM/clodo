// clodo-ui · galerie de démonstration (route dev #/styleguide, hors nav).
//
// Rend tous les composants et graphiques de la bibliothèque avec des données
// d'exemple, afin de valider le rendu visuel et de servir de garde-fou.

import { nav, GITHUB_URL } from '../site.js';
import * as ui from '../ui/index.js';

const BARS = {
  labels: ['2020', '2021', '2022', '2023', '2024', '2025'],
  series: [
    { name: 'Émissions', values: [120, 98, 84, 61, 40, 12], tone: 'accent' },
    { name: 'Compensation', values: [30, 40, 55, 60, 68, 72], tone: 'neutral' },
  ],
};

const STACKED = {
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [
    { name: 'Scope 1', values: [12, 14, 9, 7] },
    { name: 'Scope 2', values: [20, 18, 22, 16] },
    { name: 'Scope 3', values: [40, 44, 38, 30] },
  ],
};

const LINE = {
  labels: ['2024', '2025', '2026', '2027', '2030', '2035'],
  series: [
    { name: 'Réel', values: [100, 88, 70, 60, 40, 30] },
    { name: 'Trajectoire Net Zero', values: [100, 82, 64, 46, 18, 0], tone: 'muted' },
  ],
};

function chartsSection() {
  return `
    ${ui.sectionHeader({ eyebrow: 'Graphiques', title: 'Tracés', sub: 'SVG pur, responsive, thémé par variables CSS.' })}
    ${ui.card({
      title: 'Barres groupées',
      body: ui.barChart({ ...BARS, legend: true, title: 'Émissions et compensation' }),
    })}
    ${ui.card({
      title: 'Barres empilées',
      body: ui.stackedBar({ ...STACKED, legend: true, title: 'Répartition par scope' }),
    })}
    ${ui.card({
      title: 'Classement (barres horizontales)',
      body: ui.hbarChart({
        unit: '',
        items: [
          { label: 'Clodo', value: 100, highlight: true },
          { label: 'ChatGPT', value: 61 },
          { label: 'Gemini', value: 48 },
          { label: 'Claude', value: 37 },
          { label: 'Mistral', value: 22 },
        ],
        title: 'Indice de souveraineté computationnelle',
      }),
    })}
    ${ui.card({
      title: 'Valeurs négatives',
      body: ui.hbarChart({
        unit: ' %',
        items: [
          { label: 'Scope 3', value: -18 },
          { label: 'Scope 2', value: -4 },
          { label: 'Scope 1', value: 7, highlight: true },
          { label: 'Compensation', value: 22 },
        ],
        title: 'Variation signée par poste',
      }) + ui.divider() + ui.barChart({
        labels: ['2024', '2025', '2026'],
        series: [{ name: 'Écart au budget', values: [-12, 6, 18] }],
        title: 'Écart annuel (colonnes divergentes)',
      }),
    })}
    ${ui.card({
      title: 'Courbe + aire',
      body: ui.lineChart({ ...LINE, area: false, title: 'Trajectoire carbone' })
        + ui.divider({ label: 'aire' })
        + ui.areaChart({ labels: LINE.labels, series: [LINE.series[0]], title: 'Aire' }),
    })}
    ${ui.card({
      title: 'Donut, radar, jauge, sparkline',
      body: `
        <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:center">
          ${ui.donutChart({
            segments: [
              { label: 'Réutilisé', value: 64, tone: 'accent' },
              { label: 'Oublié', value: 22, tone: 'neutral' },
              { label: 'Inventé', value: 14, tone: 'warning' },
            ],
            center: { value: '64 %', label: 'circularité' },
            title: 'Circularité des réponses',
          })}
          ${ui.radarChart({
            axes: ['Vitesse', 'Précision', 'Sobriété', 'Souveraineté', 'Honnêteté', 'Politesse'],
            series: [
              { name: 'Clodo', values: [9, 9, 10, 10, 10, 10] },
              { name: 'Concurrent', values: [6, 8, 4, 2, 5, 6], tone: 'muted' },
            ],
            max: 10,
            title: 'Profil comparé',
          })}
          ${ui.gauge({ value: 92, label: '92 %', sublabel: 'Score ESG interne', title: 'Jauge' })}
        </div>
        <p style="margin-top:16px">Sparkline : ${ui.sparkline({ values: [3, 5, 4, 8, 6, 9, 12, 11, 14], title: 'Sparkline' })}</p>
      `,
    })}`;
}

function componentsSection() {
  return `
    ${ui.sectionHeader({ eyebrow: 'Composants', title: 'Briques d’interface' })}
    ${ui.kpiGrid([
      { label: 'CO₂ évité', value: '18 402', unit: 't', delta: { value: 12.4 }, tone: 'success', hint: 'depuis le dernier commit' },
      { label: 'Arbres préservés', value: '42', unit: '', delta: { value: -3.1 }, tone: 'warning' },
      { label: 'Litres d’eau', value: '0', unit: 'L', hint: 'estimation honnête' },
      { label: 'Réponses utiles', value: '∞', unit: '', delta: { value: 0 } },
    ])}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      ${ui.card({ title: 'Carte', subtitle: 'Avec sous-titre et pied', body: 'Contenu de la carte.', footer: 'Note de pied.', actions: ui.badge({ text: 'Nouveau', tone: 'accent' }) })}
      ${ui.card({ body: `${ui.badge({ text: 'accent' })} ${ui.badge({ text: 'info', tone: 'info' })} ${ui.badge({ text: 'success', tone: 'success' })} ${ui.badge({ text: 'warning', tone: 'warning' })} ${ui.badge({ text: 'danger', tone: 'danger' })} ${ui.tag('tag')}<br><br>${ui.delta(4.2)} &nbsp; ${ui.delta(-1.8)}` })}
    </div>
    ${ui.callout({ tone: 'info', title: 'Information', body: 'Encart d’information neutre.' })}
    ${ui.callout({ tone: 'warning', title: 'Attention', body: 'Encart d’avertissement.' })}
    ${ui.callout({ tone: 'danger', title: 'Risque', body: 'Encart critique.' })}
    ${ui.tabs({
      items: [
        { id: 'a', label: 'Scopes', content: ui.definitionList([{ term: 'Scope 1', desc: 'Émissions directes.' }, { term: 'Scope 2', desc: 'Énergie achetée.' }, { term: 'Scope 3', desc: 'Tout le reste.' }]) },
        { id: 'b', label: 'Méthode', content: '<p>Méthodologie propriétaire, non reproductible par construction.</p>' },
      ],
    })}
    ${ui.accordion([
      { title: 'Comment ce score est-il calculé ?', content: 'Par un réseau de neurones qui a beaucoup d’imagination.' },
      { title: 'Puis-je vérifier ?', content: 'Non, mais vous pouvez nous faire confiance.' },
    ])}
    ${ui.timeline([
      { date: '2024', title: 'Fondation', text: 'Clodo voit le jour dans un garage.' },
      { date: '2025', title: 'Premier client', text: 'Contraint et forcé.' },
      { date: '2026', title: 'Rapport ESG', text: 'Chiffres uniquement.', tone: 'warning' },
    ])}
    ${ui.stepper([{ label: 'Résumé' }, { label: 'Détail' }, { label: 'Sources' }], { current: 1 })}`;
}

function tablesSection() {
  return `
    ${ui.sectionHeader({ eyebrow: 'Tableaux', title: 'Données' })}
    ${ui.dataTable({
      caption: 'Indicateurs par scénario (triable sur les colonnes).',
      sortable: true,
      columns: [
        { key: 'name', label: 'Scénario' },
        { key: 'co2', label: 'CO₂ (t)', type: 'num' },
        { key: 'trees', label: 'Arbres', type: 'num' },
        { key: 'status', label: 'Statut', type: 'badge', tone: 'success' },
        { key: 'trend', label: 'Tendance', type: 'delta' },
      ],
      rows: [
        { name: 'Optimiste', co2: 1200, trees: 400, status: 'Vérifié', trend: { value: 8.2 } },
        { name: 'Réaliste', co2: 8400, trees: 42, status: 'Estimé', trend: { value: -2.4 } },
        { name: 'Marketing', co2: 24000, trees: 1, status: 'Audacieux', trend: { value: 131.0 } },
      ],
      totals: ['Total', '33 600', '443', '', ''],
    })}
    ${ui.comparisonTable({
      caption: 'Comparatif concurrentiel.',
      columns: [
        { key: 'clodo', label: 'Clodo', highlight: true },
        { key: 'gpt', label: 'ChatGPT' },
        { key: 'gemini', label: 'Gemini' },
      ],
      rows: [
        { label: 'Souverain', values: { clodo: true, gpt: false, gemini: false } },
        { label: 'Local', values: { clodo: true, gpt: false, gemini: false } },
        { label: 'Modeste', values: { clodo: false, gpt: false, gemini: false } },
        { label: 'Modèle', values: { clodo: 'LFM2', gpt: '?', gemini: '?' } },
      ],
    })}
    ${ui.definitionList([
      { term: 'Greenwashing', desc: 'Pratique consistant à verdir son image sans rien changer.' },
      { term: 'Circularité', desc: 'Proportion de réponses réutilisées sans vérification.' },
    ])}`;
}

export function renderStyleguide() {
  return `
    ${nav()}
    <main class="page">
      ${ui.sectionHeader({
        eyebrow: 'clodo-ui',
        title: 'Styleguide <em>interne</em>',
        sub: 'Aperçu de la bibliothèque graphique : composants, tableaux et graphiques.',
        align: 'center',
      })}
      ${ui.callout({ tone: 'neutral', title: 'Page de développement', body: 'Non référencée dans la navigation. Sert à valider le rendu des briques réutilisables.' })}
      ${componentsSection()}
      ${chartsSection()}
      ${tablesSection()}
      ${ui.disclaimer('Montants et indicateurs fictifs. Aucune donnée réelle n’a été maltraitée pour produire cette page.', { className: 'ui-footnotes' })}
      <footer class="home-footer">
        <span>Clodo — l'ia du futur.</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener">${GITHUB_URL}</a>
      </footer>
    </main>`;
}
