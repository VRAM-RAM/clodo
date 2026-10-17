// clodo-ui · jetons de couleur des graphiques.
//
// Toutes les couleurs pointent vers des variables CSS (définies dans css/ui.css)
// pour que les graphiques suivent automatiquement le thème, exactement comme le
// reste du site.

// Palette catégorielle : terracotta (accent) + gris chauds + sauge/argile.
export const SERIES = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

// Couleurs sémantiques, alignées sur les « tons » des composants.
export const TONE = {
  accent: 'var(--chart-1)',
  neutral: 'var(--chart-4)',
  muted: 'var(--muted)',
  positive: 'var(--ui-positive)',
  warning: 'var(--ui-warning)',
  danger: 'var(--ui-danger)',
  info: 'var(--ui-info)',
};

export function seriesColor(index) {
  return SERIES[((index % SERIES.length) + SERIES.length) % SERIES.length];
}

export function toneColor(tone, fallback = 'accent') {
  if (!tone) return TONE[fallback];
  if (tone in TONE) return TONE[tone];
  if (typeof tone === 'string') return tone;
  return TONE[fallback];
}
