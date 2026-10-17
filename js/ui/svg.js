// clodo-ui · primitives SVG de bas niveau partagées par les graphiques.

import { attr, esc } from './format.js';

// Géométrie par défaut d'un graphique (viewBox sans unité, responsive).
export const CHART = {
  width: 640,
  height: 260,
  pad: { top: 24, right: 16, bottom: 36, left: 48 },
};

export function num2(n) {
  return Math.round(n * 100) / 100;
}

// Sérialise un élément SVG. Les enfants sont insérés bruts (déjà sérialisés).
export function svgEl(tag, attrs = {}, children = '') {
  const a = attr(attrs);
  const open = a ? `<${tag} ${a}>` : `<${tag}>`;
  if (children === '' || children == null) return a ? `<${tag} ${a}/>` : `<${tag}/>`;
  return `${open}${children}</${tag}>`;
}

// Racine `<svg>` : viewBox responsive + accessibilité (role=img, title/desc).
export function svgRoot({ viewBox, className = 'ui-chart', title, desc, children, attrs = {} }) {
  const labelled = title || desc;
  const a11y = {
    role: 'img',
    'aria-hidden': labelled ? null : true,
    'aria-label': !title && desc ? desc : null,
    ...attrs,
  };
  const head = [
    title ? `<title>${esc(title)}</title>` : '',
    desc ? `<desc>${esc(desc)}</desc>` : '',
  ].join('');
  return svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox,
    class: className,
    preserveAspectRatio: 'xMidYMid meet',
    ...a11y,
  }, head + children);
}

// Coordonnées polaires → cartésiennes (angles en degrés, 0° = haut, sens horaire).
export function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [num2(cx + r * Math.cos(a)), num2(cy + r * Math.sin(a))];
}

export function pointsAttr(points) {
  return points.map(([x, y]) => `${num2(x)},${num2(y)}`).join(' ');
}
