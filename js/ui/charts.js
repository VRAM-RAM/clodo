// clodo-ui · graphiques SVG.
//
// Fonctions pures et déterministes : mêmes entrées → même sortie. Aucune
// dépendance, aucun accès DOM. Chaque graphique renvoie une chaîne `<svg>`
// (responsive via viewBox) avec `role="img"` + `<title>/<desc>`.

import { esc, num, niceScale, scale, sum, linePath } from './format.js';
import { CHART, svgEl, svgRoot, polar, pointsAttr, num2 } from './svg.js';
import { seriesColor, toneColor } from './theme.js';

const AXIS = { grid: 'var(--chart-grid)', text: 'var(--muted)', font: 'var(--sans)' };

function normalize(series) {
  const list = Array.isArray(series) ? series : (series ? [series] : []);
  return list.map((s, i) => {
    if (Array.isArray(s)) return { name: `Série ${i + 1}`, values: s, tone: seriesColor(i) };
    return {
      name: s.name ?? `Série ${i + 1}`,
      values: s.values ?? [],
      tone: s.color || toneColor(s.tone, undefined) || seriesColor(i),
    };
  });
}

function frame({ width = CHART.width, height = CHART.height, pad = CHART.pad }) {
  return {
    width,
    height,
    pad,
    x0: pad.left,
    y0: pad.top,
    x1: width - pad.right,
    y1: height - pad.bottom,
  };
}

function grid2d(f, ticks) {
  const lo = ticks[0].value;
  const hi = ticks[ticks.length - 1].value;
  return ticks.map((t) => {
    const y = num2(scale(t.value, lo, hi, f.y1, f.y0));
    return [
      svgEl('line', { x1: f.x0, x2: f.x1, y1: y, y2: y, stroke: AXIS.grid, 'stroke-width': 1 }),
      svgEl('text', { x: f.x0 - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: AXIS.text }, esc(t.label)),
    ].join('');
  }).join('');
}

function legend({ series, x, y, anchor = 'start' }) {
  let cursor = x;
  const items = series.map((s) => {
    const item = [
      svgEl('rect', { x: num2(cursor), y: y - 8, width: 10, height: 10, rx: 2, fill: s.tone }),
      svgEl('text', { x: num2(cursor + 15), y: y + 1, 'font-size': 12, fill: AXIS.text, 'font-family': AXIS.font }, esc(s.name)),
    ].join('');
    cursor += 15 + String(s.name).length * 7 + 18;
    return item;
  }).join('');
  const width = cursor - x - 18;
  const dx = anchor === 'end' ? -width : 0;
  return svgEl('g', { transform: `translate(${num2(dx)} 0)` }, items);
}

// Barres (groupées ou empilées)
export function barChart({
  labels = [],
  series,
  stacked = false,
  legend: showLegend = false,
  unit = '',
  width = CHART.width,
  height = CHART.height,
  className = 'ui-chart',
  title,
  desc,
} = {}) {
  const data = normalize(series);
  const n = labels.length;
  if (!n || !data.length) return emptyChart({ width, height, className, title, desc });

  const all = stacked
    ? labels.map((_, i) => sum(data.map((s) => s.values[i] || 0)))
    : data.flatMap((s) => s.values);
  const scaleObj = niceScale(Math.min(0, ...all), Math.max(0, ...all), 5);
  const ticks = scaleObj.ticks.map((v) => ({ value: v, label: num(v, { compact: Math.abs(v) >= 1000 }) + (unit ? ` ${unit}` : '') }));

  const top = showLegend ? CHART.pad.top + 18 : CHART.pad.top;
  const f = frame({ width, height, pad: { ...CHART.pad, top } });
  const W = f.x1 - f.x0;
  const yOf = (v) => num2(scale(v, scaleObj.min, scaleObj.max, f.y1, f.y0));
  const yBase = yOf(0);

  const band = W / n;
  let bars = '';
  labels.forEach((label, i) => {
    const bx = f.x0 + i * band;
    if (stacked) {
      const bw = band * 0.56;
      let pos = 0;
      let neg = 0;
      data.forEach((s) => {
        const v = s.values[i] || 0;
        const yTop = yOf(v >= 0 ? pos : neg);
        const yBot = yOf(v >= 0 ? pos + v : neg + v);
        bars += svgEl('rect', {
          x: num2(bx + (band - bw) / 2), y: num2(Math.min(yTop, yBot)), width: num2(bw),
          height: num2(Math.abs(yBot - yTop)), fill: s.tone, rx: 2,
        });
        if (v >= 0) pos += v; else neg += v;
      });
    } else {
      const bw = (band * 0.7) / data.length;
      data.forEach((s, k) => {
        const yv = yOf(s.values[i] || 0);
        bars += svgEl('rect', {
          x: num2(bx + band * 0.15 + k * bw), y: num2(Math.min(yv, yBase)), width: num2(bw * 0.9),
          height: num2(Math.abs(yBase - yv)), fill: s.tone, rx: 2,
        });
      });
    }
    bars += svgEl('text', { x: num2(bx + band / 2), y: f.y1 + 16, 'text-anchor': 'middle', 'font-size': 11, fill: AXIS.text }, esc(label));
  });

  const baseline = svgEl('line', { x1: f.x0, x2: f.x1, y1: yBase, y2: yBase, stroke: 'var(--chart-axis)', 'stroke-width': 1 });
  const body = grid2d(f, ticks) + bars + baseline
    + (showLegend ? legend({ series: data, x: f.x1, y: 14, anchor: 'end' }) : '');
  return wrap(body, { width, height, className, title, desc });
}

export function stackedBar(opts = {}) {
  return barChart({ ...opts, stacked: true });
}

// Barres horizontales (classements)
export function hbarChart({
  items = [],
  min,
  max,
  unit = '',
  width = CHART.width,
  height,
  className = 'ui-chart',
  title,
  desc,
} = {}) {
  const n = items.length;
  const h = height || Math.max(80, n * 34 + 24);
  if (!n) return emptyChart({ width, height: h, className, title, desc });

  // Domaine incluant 0 : les barres négatives partent à gauche de l'axe au zéro.
  const values = items.map((it) => Number(it.value) || 0);
  const lo = Math.min(0, min ?? Math.min(0, ...values));
  const hi = Math.max(0, max ?? Math.max(0, ...values));
  const crossesZero = lo < 0 && hi > 0;
  const negGutter = lo < 0
    ? Math.max(...values.filter((v) => v < 0).map((v) => `${num(v)}${unit}`.length)) * 7 + 12
    : 0;

  const pad = { top: 8, right: 56, bottom: 8, left: 150 + negGutter };
  const f = frame({ width, height: h, pad });
  const W = f.x1 - f.x0;
  const zeroX = scale(0, lo, hi, f.x0, f.x1);
  const labelX = f.x0 - negGutter - 10;
  const rowH = (h - pad.top - pad.bottom) / n;

  const rows = items.map((it, i) => {
    const value = values[i];
    const barH = Math.min(22, rowH * 0.6);
    const barY = num2(pad.top + i * rowH + (rowH - barH) / 2);
    const tip = scale(value, lo, hi, f.x0, f.x1);
    const positive = value >= 0;
    return [
      svgEl('text', { x: num2(labelX), y: num2(barY + barH / 2 + 4), 'text-anchor': 'end', 'font-size': 12, fill: AXIS.text }, esc(it.label)),
      svgEl('rect', { x: f.x0, y: barY, width: num2(W), height: num2(barH), rx: 4, fill: 'var(--chart-track)' }),
      svgEl('rect', { x: num2(Math.min(zeroX, tip)), y: barY, width: num2(Math.abs(tip - zeroX)), height: num2(barH), rx: 4, fill: it.highlight ? seriesColor(0) : seriesColor(3) }),
      svgEl('text', {
        x: num2(positive ? f.x1 + 8 : tip - 8),
        y: num2(barY + barH / 2 + 4),
        'text-anchor': positive ? 'start' : 'end',
        'font-size': 12, 'font-weight': 600, fill: 'var(--text)',
      }, esc(`${num(value)}${unit}`)),
    ].join('');
  }).join('');

  const axis = crossesZero
    ? svgEl('line', { x1: num2(zeroX), x2: num2(zeroX), y1: pad.top, y2: num2(h - pad.bottom), stroke: 'var(--chart-axis)', 'stroke-width': 1 })
    : '';

  return wrap(axis + rows, { width, height: h, className, title, desc });
}

// Lignes / aires
export function lineChart({
  labels = [],
  series,
  area = false,
  points = true,
  unit = '',
  width = CHART.width,
  height = CHART.height,
  className = 'ui-chart',
  title,
  desc,
} = {}) {
  const data = normalize(series);
  const n = labels.length;
  if (n < 1 || !data.length) return emptyChart({ width, height, className, title, desc });

  const maxValue = Math.max(...data.flatMap((s) => s.values));
  const scaleObj = niceScale(0, maxValue, 5);
  const ticks = scaleObj.ticks.map((v) => ({ value: v, label: num(v, { compact: v >= 1000 }) + (unit ? ` ${unit}` : '') }));
  const f = frame({ width, height });
  const W = f.x1 - f.x0;
  const yOf = (v) => num2(scale(v, scaleObj.min, scaleObj.max, f.y1, f.y0));
  const xOf = (i) => (n === 1 ? f.x0 + W / 2 : f.x0 + (i / (n - 1)) * W);

  let marks = '';
  data.forEach((s) => {
    const pts = s.values.map((v, i) => [xOf(i), yOf(v)]);
    if (area && pts.length) {
      marks += svgEl('path', {
        d: `${linePath(pts)} L${num2(pts[pts.length - 1][0])} ${f.y1} L${num2(pts[0][0])} ${f.y1} Z`,
        fill: s.tone, opacity: 0.12,
      });
    }
    marks += svgEl('path', { d: linePath(pts), fill: 'none', stroke: s.tone, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    if (points) {
      marks += pts.map(([x, y]) => svgEl('circle', { cx: num2(x), cy: y, r: 3.2, fill: 'var(--surface)', stroke: s.tone, 'stroke-width': 2 })).join('');
    }
  });

  const xLabels = labels.map((label, i) => svgEl('text', {
    x: num2(xOf(i)), y: f.y1 + 16, 'text-anchor': 'middle', 'font-size': 11, fill: AXIS.text,
  }, esc(label))).join('');

  const baseline = svgEl('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: 'var(--chart-axis)', 'stroke-width': 1 });
  const body = grid2d(f, ticks) + marks + baseline + xLabels
    + (data.length > 1 ? legend({ series: data, x: f.x1, y: 14, anchor: 'end' }) : '');
  return wrap(body, { width, height, className, title, desc });
}

export function areaChart(opts = {}) {
  return lineChart({ ...opts, area: true });
}

// Sparkline (mini-courbe sans axes)
export function sparkline({
  values = [],
  tone,
  width = 160,
  height = 44,
  className = 'ui-sparkline',
  title,
  desc,
} = {}) {
  if (values.length < 2) return emptyChart({ width, height, className, title, desc });

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const xOf = (i) => num2(scale(i, 0, values.length - 1, 1, width - 1));
  const yOf = (v) => num2(scale(v, lo, hi, height - 4, 4));
  const pts = values.map((v, i) => [xOf(i), yOf(v)]);
  const color = toneColor(tone) || seriesColor(0);
  const children = svgEl('path', {
    d: `${linePath(pts)} L${num2(width)} ${height} L0 ${height} Z`,
    fill: color, opacity: 0.12,
  }) + svgEl('path', { d: linePath(pts), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  return svgRoot({ viewBox: `0 0 ${width} ${height}`, className, title, desc, attrs: { width, height }, children });
}

// Donut
export function donutChart({
  segments = [],
  center,
  size = 200,
  thickness = 28,
  className = 'ui-chart',
  title,
  desc,
} = {}) {
  const total = sum(segments.map((s) => s.value));
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s, i) => {
    const len = total ? (s.value / total) * circ : 0;
    const el = svgEl('circle', {
      cx: c, cy: c, r: num2(r), fill: 'none',
      stroke: s.color || toneColor(s.tone, undefined) || seriesColor(i),
      'stroke-width': thickness,
      'stroke-dasharray': `${num2(len)} ${num2(circ - len)}`,
      'stroke-dashoffset': num2(-offset),
      transform: `rotate(-90 ${c} ${c})`,
    });
    offset += len;
    return el;
  }).join('');

  const centerText = center
    ? svgEl('text', { x: c, y: c - 2, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 600, fill: 'var(--text)', 'font-family': 'var(--serif)' }, esc(center.value ?? ''))
      + svgEl('text', { x: c, y: c + 20, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)' }, esc(center.label ?? ''))
    : '';

  const track = svgEl('circle', { cx: c, cy: c, r: num2(r), fill: 'none', stroke: 'var(--chart-track)', 'stroke-width': thickness });
  return svgRoot({
    viewBox: `0 0 ${size} ${size}`,
    className,
    title,
    desc,
    attrs: { width: size, height: size },
    children: track + arcs + centerText,
  });
}

// Radar
export function radarChart({
  axes = [],
  series,
  max,
  size = 280,
  levels = 4,
  className = 'ui-chart',
  title,
  desc,
} = {}) {
  const data = normalize(series);
  const n = axes.length;
  if (n < 3 || !data.length) return emptyChart({ width: size, height: size, className, title, desc });

  const maxValue = max || Math.max(...data.flatMap((s) => s.values));
  const c = size / 2;
  const r = size / 2 - 34;

  const grid = [];
  for (let l = 1; l <= levels; l++) {
    const rr = (r * l) / levels;
    const pts = axes.map((_, i) => polar(c, c, rr, (i * 360) / n));
    grid.push(svgEl('polygon', { points: pointsAttr(pts), fill: 'none', stroke: AXIS.grid, 'stroke-width': 1 }));
  }
  const spokes = axes.map((_, i) => {
    const [x, y] = polar(c, c, r, (i * 360) / n);
    return svgEl('line', { x1: c, y1: c, x2: x, y2: y, stroke: AXIS.grid, 'stroke-width': 1 });
  }).join('');
  const axisLabels = axes.map((label, i) => {
    const [x, y] = polar(c, c, r + 16, (i * 360) / n);
    return svgEl('text', { x, y: num2(y + 4), 'text-anchor': 'middle', 'font-size': 11, fill: AXIS.text }, esc(label));
  }).join('');

  const polys = data.map((s) => {
    const pts = s.values.map((v, i) => polar(c, c, (Math.min(v, maxValue) / maxValue) * r, (i * 360) / n));
    return svgEl('polygon', { points: pointsAttr(pts), fill: s.tone, 'fill-opacity': 0.15, stroke: s.tone, 'stroke-width': 2 });
  }).join('');

  return svgRoot({ viewBox: `0 0 ${size} ${size}`, className, title, desc, attrs: { width: size, height: size }, children: grid.join('') + spokes + polys + axisLabels });
}

// Jauge (demi-cercle)
export function gauge({
  value = 0,
  max = 100,
  label,
  sublabel,
  size = 220,
  thickness = 18,
  tone,
  className = 'ui-chart',
  title,
  desc,
} = {}) {
  const c = size / 2;
  const cy = size * 0.62;
  const r = size / 2 - thickness;
  const ratio = Math.max(0, Math.min(1, max ? value / max : 0));

  const body = [
    svgEl('path', { d: arcPath(c, cy, r, 180, 0), fill: 'none', stroke: 'var(--chart-track)', 'stroke-width': thickness, 'stroke-linecap': 'round' }),
    svgEl('path', { d: arcPath(c, cy, r, 180, 180 - 180 * ratio), fill: 'none', stroke: toneColor(tone) || seriesColor(0), 'stroke-width': thickness, 'stroke-linecap': 'round' }),
    svgEl('text', { x: c, y: cy - 6, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 600, fill: 'var(--text)', 'font-family': 'var(--serif)' }, esc(label ?? num(value))),
    sublabel ? svgEl('text', { x: c, y: cy + 16, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)' }, esc(sublabel)) : '',
  ].join('');

  return svgRoot({ viewBox: `0 0 ${size} ${num2(size * 0.78)}`, className, title, desc, attrs: { width: size }, children: body });
}

// Arc mathématique (0° = droite, sens anti-horaire) rendu en coordonnées écran.
function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => {
    const rad = (a * Math.PI) / 180;
    return [num2(cx + r * Math.cos(rad)), num2(cy - r * Math.sin(rad))];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const largeArc = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 < a0 ? 1 : 0;
  return `M${x0} ${y0} A${num2(r)} ${num2(r)} 0 ${largeArc} ${sweep} ${x1} ${y1}`;
}

// Utilitaires internes
function wrap(children, { width, height, className, title, desc }) {
  return svgRoot({ viewBox: `0 0 ${width} ${height}`, className, title, desc, children });
}

function emptyChart({ width, height, className, title, desc }) {
  return svgRoot({
    viewBox: `0 0 ${width} ${height}`,
    className: `${className} ui-chart--empty`,
    title,
    desc,
    children: svgEl('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--muted)' }, esc('Aucune donnée')),
  });
}
