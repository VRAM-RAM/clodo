// clodo-ui · bas niveau : échappement, attributs, classes, formatage fr-FR,
// et calcul d'échelle « nice » pour les graphiques.
//
// La lib est volontairement sans dépendance et autonome : `esc` est ré-implémenté
// ici (plutôt qu'importé de app.js) pour éviter tout import circulaire.

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// Sérialise un objet en attributs HTML. `null`, `undefined` et `false` sont
// ignorés ; `true` produit un attribut booléen nu. Tout est échappé.
export function attr(map = {}) {
  const parts = [];
  for (const [key, value] of Object.entries(map)) {
    if (value == null || value === false) continue;
    if (value === true) { parts.push(key); continue; }
    parts.push(`${key}="${esc(value)}"`);
  }
  return parts.join(' ');
}

// Joint des classes en filtrant les valeurs vides.
export function cx(...names) {
  return names.flat().filter(Boolean).join(' ');
}

const FR = 'fr-FR';

function numberFormat(opts = {}) {
  const { decimals = 0, compact = false, sign = false } = opts;
  return new Intl.NumberFormat(FR, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard',
    signDisplay: sign ? 'exceptZero' : 'auto',
  });
}

// `num(12345.6, { decimals: 1 })` → « 12 345,6 ».
export function num(value, opts) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return numberFormat(opts).format(n);
}

// `pct(0.42)` → « 42 % ». La valeur est un ratio 0..1 par défaut.
export function pct(ratio, opts = {}) {
  const n = Number(ratio);
  if (!Number.isFinite(n)) return '—';
  const value = opts.fromPercent ? n : n * 100;
  return `${numberFormat(opts).format(value)}${opts.space === false ? '' : '\u00a0'}%`;
}

// `eur(1234)` → « 1 234 € ».
export function eur(value, opts = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const { decimals = 0, compact = false } = opts;
  const amount = compact
    ? new Intl.NumberFormat(FR, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : new Intl.NumberFormat(FR, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  return `${amount}\u00a0€`;
}

export function date(value, opts = {}) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(FR, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  }).format(d);
}

// Échelle « nice » : arrondit [min, max] et renvoie des paliers lisibles.
// Utilisée par tous les axes de graphiques ; exportée pour les tests.
export function niceScale(min, max, ticks = 5) {
  let lo = Number(min);
  let hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (lo === hi) { hi = lo + (lo === 0 ? 1 : Math.abs(lo) * 0.1); }
  if (hi < lo) [lo, hi] = [hi, lo];

  const range = hi - lo;
  const rawStep = range / Math.max(1, ticks);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / magnitude;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 2.5) step = 2.5;
  else if (norm <= 5) step = 5;
  else step = 10;
  step *= magnitude;

  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const round = (n) => Number(n.toFixed(decimals + 1));

  const list = [];
  for (let v = niceMin; v <= niceMax + step * 1e-9; v += step) list.push(round(v));
  return { min: round(niceMin), max: round(niceMax), step: round(step), ticks: list };
}

// Ramène une valeur de [d0, d1] vers [r0, r1].
export function scale(value, d0, d1, r0, r1) {
  if (d1 === d0) return r0;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

export function sum(list) {
  return list.reduce((acc, n) => acc + (Number(n) || 0), 0);
}

// Construit un path SVG « L » à partir de points [[x,y], …].
export function linePath(points) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round2(x)} ${round2(y)}`).join(' ');
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
