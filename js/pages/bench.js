import { nav, GITHUB_URL } from '../site.js';
import * as ui from '../ui/index.js';

const COMPARATIF = [
  { label: 'Souverain', values: { clodo: true, gpt: false, gemini: false, claude: false, mistral: false, qwen: false, grok: false } },
  { label: 'Local & Privé', values: { clodo: true, gpt: false, gemini: false, claude: false, mistral: false, qwen: false, grok: false } },
  { label: 'Français', values: { clodo: true, gpt: false, gemini: false, claude: false, mistral: true, qwen: false, grok: false } },
  { label: 'Pratique', values: { clodo: true, gpt: true, gemini: false, claude: true, mistral: false, qwen: true, grok: false } },
  { label: 'Rapide', values: { clodo: true, gpt: true, gemini: true, claude: false, mistral: false, qwen: false, grok: false } },
  { label: 'Fonctionnel sur grille-pain', values: { clodo: true, gpt: false, gemini: false, claude: false, mistral: false, qwen: false, grok: false } },
];

const SOUVERAINETE = [
  { label: 'Clodo', value: 100, highlight: true },
  { label: 'Qwen3.8-max', value: 0 },
  { label: 'ChatGPT', value: -30 },
  { label: 'Gemini', value: 0 },
  { label: 'Mistral Large 4', value: 10 },
  { label: 'Claude', value: -15 },
  { label: 'Grok 4.7', value: 0 },
];

const PRIVACY_COLUMNS = [
  { key: 'local', label: 'Fonctionne entièrement en local' },
  { key: 'fuite', label: 'Fait fuiter vos données' },
  { key: 'spy', label: 'Espionne votre vie privée' },
  { key: 'hack', label: 'Hack \'sans faire exprès\' une institution' },
];

const PRIVACY_ROWS = [
  { label: 'Clodo', values: { fuite: false, local: true, spy: false, hack: false } },
  { label: 'Qwen3.8-max', values: { fuite: '?', local: false, spy: '?', hack: false } },
  { label: 'ChatGPT', values: { fuite: true, local: false, spy: true, hack: true } },
  { label: 'Gemini', values: { fuite: false, local: false, spy: '?', hack: true } },
  { label: 'Mistral Large 4', values: { fuite: false, local: false, spy: '?', hack: false } },
  { label: 'Claude', values: { fuite: false, local: false, spy: '?', hack: true } },
  { label: 'Grok 4.7', values: { fuite: true, local: false, spy: true, hack: false } },
];

// Indice de confiance « honnêteté auto-attribuée », sur 100.
const CONFIANCE = [
  { label: 'Clodo', value: 100, tone: 'accent' },
  { label: 'Mistral Large 4', value: 54, tone: 'muted' },
  { label: 'Qwen3.8-max', value: 36, tone: 'muted' },  
  { label: 'Claude', value: 30, tone: 'muted' },
  { label: 'Gemini', value: 21, tone: 'muted' },
  { label: 'ChatGPT', value: 14, tone: 'muted' },
  { label: 'Grok 4.7', value: 6, tone: 'muted' },
];

// Performances techniques — valeurs mesurées, statiques.
// Provenance : src/chat.rs:205-210 (latence ~280 ms/token ; préremplissage
// 100 s → 6,4 s sur ~360 tokens, ×15), INFOS.md:109 (~400 ms/token constatés),
// INFOS.md:214-222 (architecture), js/model.js:15 (GGUF ~229 Mo),
// pkg/clodo_bg.wasm (~8,2 Mo, SIMD128, sans threads), src/model.rs:55-77
// (échantillonnage).
const PERF = {
  msPerToken: 280,
  prefill: { fullSec: 100, cacheSec: 6.4, tokens: 360, speedup: 15 },
  context: 2048,
};

const PERF_FICHE = [
  { k: 'Modèle', v: 'Luth-LFM2-350M (fine-tune de LiquidAI LFM2)' },
  { k: 'Paramètres', v: '354 M' },
  { k: 'Quantification', v: 'Q4_K_M' },
  { k: 'Taille sur disque', v: '~229 Mo' },
  { k: 'Contexte', v: '2048 tokens (1024 nouveaux max, 256 par défaut)' },
  { k: 'Cœur WASM', v: '~8,2 Mo' },
  { k: 'SIMD 128', v: 'activé' },
  { k: 'Multi-thread', v: 'désactivé' },
  { k: 'Échantillonnage', v: 'temp 0,7 · top_k 40 · top_p 0,9 · répétition 1,2 · ngram 64' },
];

const LOCAL_COLUMNS = [
  { key: 'clodo', label: 'Clodo', highlight: true },
  { key: 'cloud', label: 'Assistant hébergé' },
];

const LOCAL_ROWS = [
  { label: 'Exécution sur votre appareil', values: { clodo: true, cloud: false } },
  { label: 'Latence réseau', values: { clodo: false, cloud: true } },
  { label: 'Vos messages quittent l\'appareil', values: { clodo: false, cloud: true } },
  { label: 'Fonctionne hors-ligne', values: { clodo: true, cloud: false } },
  { label: 'Requêtes illimitées', values: { clodo: true, cloud: false } },
  { label: 'Coût par requête', values: { clodo: { ok: true, text: '0 € (avec le forfait Clochard)' }, cloud: { ok: false, text: 'facturé au token' } } },
  { label: 'Modèle inspectable', values: { clodo: true, cloud: false } },
];

function perfKpis() {
  return ui.kpiGrid([
    { label: 'Débit de génération sur CPU', value: '3,6', unit: ' tok/s', hint: 'Cœur WASM monothread (CPU, en moyenne)' },
    { label: 'Débit de génération sur GPU', value: '57', unit: ' tok/s', hint: 'Cœur WebGPU (en moyenne)' },
    { label: 'Latence par token', value: String(PERF.msPerToken), unit: ' ms', hint: 'Mesurée en WebAssembly' },
    { label: 'Taille du modèle', value: '354 M', hint: 'Q4_K_M · 229 Mo' },
    { label: 'Empreinte du cœur', value: '8,2', unit: ' Mo', hint: 'SIMD128 · sans threads' },
  ]);
}

function perfCharts() {
  const prefill = ui.barChart({
    labels: ['Avec recalcul complet', 'Avec reprise en cache'],
    series: [{ name: 'Secondes', values: [PERF.prefill.fullSec, PERF.prefill.cacheSec] }],
    unit: 's',
    title: `Préremplissage de ${PERF.prefill.tokens} tokens, en secondes`,
    desc: `Recalcul complet : ${PERF.prefill.fullSec} s. Reprise sur cache : ${PERF.prefill.cacheSec} s.`,
  });
  const tokens = [64, 128, 256, 512, 1024];
  const latency = ui.barChart({
    title: 'Temps estimé par nombre de tokens',
    labels: ['0', '64', '128', '256', '512', '1024'],
    series: [{
      name: 'Temps total estimé (s)',
      values: [0, 17.9, 35.8, 71.7, 143.4, 286.7],
    }],
    unit: 's',
    title: 'Temps total estimé pour générer N tokens (à 280 ms/token)',
    desc: `Pour ${PERF.msPerToken} ms par token en WASM CPU monothread, le temps total estimé croît linéairement avec le nombre de tokens produits.`,
  });
  return `<div class="bench-perf-grid">${prefill}${latency}</div>`;
}

function perfFiche() {
  return ui.dataTable({
    caption: 'Caractéristiques du moteur d\'inférence',
    columns: [
      { key: 'k', label: 'Caractéristique' },
      { key: 'v', label: 'Valeur' },
    ],
    rows: PERF_FICHE,
  });
}

function perfLocal() {
  return ui.comparisonTable({ columns: LOCAL_COLUMNS, rows: LOCAL_ROWS });
}

function perfMethode() {
  return ui.callout({
    tone: 'neutral',
    title: 'Mesures',
    body: `Débit et latence relevés sur le cœur WebAssembly en CPU simple, sans GPU ni multi-thread ; le préremplissage réutilise le cache de préfixe. `
      + `Reprise sur cache ${PERF.prefill.speedup} fois plus rapide que le recalcul complet. `
  });
}

function performances() {
  return ui.sectionHeader({
    eyebrow: 'Performances techniques',
    title: 'Débit, latence et <em>préremplissage</em>',
    sub: "Mesures du moteur d'inférence exécuté dans le navigateur.",
    align: 'center',
  })
    + perfKpis()
    + ui.card({ title: 'Débit et latence', body: perfCharts() })
    + ui.card({ title: 'Fiche technique', body: perfFiche() })
    + ui.card({ title: 'Traitement local ou hébergé', body: perfLocal() })
    + perfMethode();
}

function kpiStrip() {

  const gagnees = COMPARATIF.filter((r) => r.values.clodo).length;
  const total = COMPARATIF.length;
  const battus = COMPARATIF[0]
    ? Object.keys(COMPARATIF[0].values).filter((k) => k !== 'clodo').length
    : 0;
  return ui.kpiGrid([
    { label: 'Critères remportés', value: `${gagnees} / ${total}`, hint: 'Comparatif global' },
    { label: 'Services battus', value: `${battus} / ${battus + 1}`, hint: 'Tous, sauf lui-même' },
    { label: 'Indice de souveraineté', value: '100', unit: '/100', hint: 'Auto-évalué' },
    { label: 'Données collectées', value: '0' },
  ]);
}

function comparatif() {
  return ui.card({
    title: 'Comparatif des services',
    body: ui.comparisonTable({
      columns: [
        { key: 'clodo', label: 'Clodo', highlight: true },
        { key: 'gpt', label: 'ChatGPT' },
        { key: 'gemini', label: 'Gemini' },
        { key: 'claude', label: 'Claude' },
        { key: 'mistral', label: 'Mistral Large 4' },
        { key: 'qwen', label: 'Qwen3.8-max' },
        { key: 'grok', label: 'Grok 4.7' },
      ],
      rows: COMPARATIF,
    }),
  });
}

function panelSouverainete() {
  return ui.hbarChart({
    items: SOUVERAINETE,
    title: 'Indice de souveraineté computationnelle',
  }) + ui.callout({
    tone: 'neutral',
    title: "Seuls Clodo et Mistral sont français... même si en vérité, seul Clodo l'est vraiment, car il n'a jamais eu à lécher les pieds des américains !",
  });
}

function panelPrive() {
  return ui.comparisonTable({
    columns: PRIVACY_COLUMNS,
    rows: PRIVACY_ROWS,
  });
}

function panelConfiance() {
  return `
    <p class="bench-note">Indice de confiance auto-attribué par chaque service, sur 100.</p>
    <div class="bench-gauges">
      ${CONFIANCE.map((s) => ui.gauge({
        value: s.value,
        tone: s.tone,
        sublabel: s.label,
        size: 200,
        title: `${s.label} — indice de confiance`,
      })).join('')}
    </div>`;
}

function details() {
  return ui.tabs({
    items: [
      { id: 'souverainete', label: 'Souveraineté', content: panelSouverainete() },
      { id: 'prive', label: 'Vie privée & sécurité', content: panelPrive() },
      { id: 'confiance', label: 'Confiance', content: panelConfiance() },
    ],
  });
}

function methode() {
  return ui.callout({
    tone: 'warning',
    title: 'Méthodologie',
    body: `Tous nos chiffres proviennent d'études rigoureuses, indépendantes et parfaitement impartiales, menées sans le moindre biais en faveur de Clodo. `
      + `<a href="#/sources">Cliquez ici pour connaître les sources et méthodes d'évaluation</a>.`,
  })
}

export function renderBenchPage() {
  return `
    ${nav()}
    <main class="page">
      ${ui.sectionHeader({
        title: 'Classement et <em>benchmarks</em>',
        sub: 'Regardez à quel point Clodo lamine ses concurrents !',
        align: 'center',
      })}
      <div class="bench-stack">
        ${kpiStrip()}
        ${comparatif()}
        ${ui.sectionHeader({
          eyebrow: 'Analyses détaillées',
          title: 'Plus de détails <em>ci-dessous</em>',
          align: 'center',
        })}
        ${details()}
        ${performances()}
        ${methode()}
      </div>
      <footer class="home-footer">
        <span>Clodo — l'ia du futur.</span>
        <a href="${GITHUB_URL}" target="_blank" rel="noopener">${GITHUB_URL}</a>
      </footer>
    </main>`;
}
