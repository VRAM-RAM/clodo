// clodo-ui · composants d'interface (HTML, sans état).
//
// Tous renvoient une chaîne HTML et s'appuient sur les classes `ui-*` de
// css/ui.css. L'interactivité éventuelle (onglets) est branchée par enhance().

import { esc, cx, attr, num, pct as pctFmt } from './format.js';

const TONES = new Set(['accent', 'neutral', 'muted', 'info', 'success', 'warning', 'danger']);
function toneClass(base, tone) {
  return tone && TONES.has(tone) ? `${base} ${base}--${tone}` : base;
}

export function sectionHeader({ eyebrow, title, sub, align = 'left', className } = {}) {
  return `
    <header class="${cx('ui-section', `ui-section--${align}`, className)}">
      ${eyebrow ? `<div class="ui-section__eyebrow">${esc(eyebrow)}</div>` : ''}
      ${title ? `<h2 class="ui-section__title">${title}</h2>` : ''}
      ${sub ? `<p class="ui-section__sub">${esc(sub)}</p>` : ''}
    </header>`;
}

export function card({ title, subtitle, body = '', actions = '', footer = '', tone, className, id } = {}) {
  return `
    <section class="${toneClass('ui-card', tone)}${className ? ` ${className}` : ''}"${attr({ id })}>
      ${title || subtitle || actions ? `
        <header class="ui-card__head">
          <div>
            ${title ? `<h3 class="ui-card__title">${esc(title)}</h3>` : ''}
            ${subtitle ? `<p class="ui-card__subtitle">${esc(subtitle)}</p>` : ''}
          </div>
          ${actions ? `<div class="ui-card__actions">${actions}</div>` : ''}
        </header>` : ''}
      <div class="ui-card__body">${body}</div>
      ${footer ? `<footer class="ui-card__foot">${footer}</footer>` : ''}
    </section>`;
}

export function badge({ text, tone, className } = {}) {
  return `<span class="${toneClass('ui-badge', tone)}${className ? ` ${className}` : ''}">${esc(text)}</span>`;
}

export function tag(text, { tone, className } = {}) {
  return `<span class="${toneClass('ui-tag', tone)}${className ? ` ${className}` : ''}">${esc(text)}</span>`;
}

export function delta(value, { direction, decimals = 1, suffix = ' %' } = {}) {
  const dir = direction || (Number(value) >= 0 ? 'up' : 'down');
  const arrow = dir === 'up' ? '▲' : '▼';
  const sign = Number(value) > 0 ? '+' : '';
  const shown = `${sign}${num(value, { decimals })}${suffix}`;
  return `<span class="ui-delta ui-delta--${dir}">${arrow} ${esc(shown)}</span>`;
}

export function statTile({ label, value, unit = '', delta: d, hint, tone, spark } = {}) {
  return `
    <div class="${toneClass('ui-stat', tone)}">
      <div class="ui-stat__label">${esc(label)}</div>
      <div class="ui-stat__value">${esc(value)}${unit ? `<span class="ui-stat__unit">${esc(unit)}</span>` : ''}</div>
      ${d ? `<div class="ui-stat__delta">${typeof d === 'string' ? d : delta(d.value, d)}</div>` : ''}
      ${spark ? `<div class="ui-stat__spark">${spark}</div>` : ''}
      ${hint ? `<div class="ui-stat__hint">${esc(hint)}</div>` : ''}
    </div>`;
}

export function kpiGrid(items = [], { className } = {}) {
  const body = items.map((it) => (typeof it === 'string' ? it : statTile(it))).join('');
  return `<div class="${cx('ui-kpis', className)}">${body}</div>`;
}

export function callout({ tone = 'info', title, body = '', className } = {}) {
  const icons = { info: 'ℹ', success: '✓', warning: '!', danger: '⚠' };
  return `
    <aside class="${toneClass('ui-callout', tone)}${className ? ` ${className}` : ''}" role="note">
      ${tone in icons ? `<span class="ui-callout__icon" aria-hidden="true">${icons[tone]}</span>` : ''}
      <div class="ui-callout__content">
        ${title ? `<div class="ui-callout__title">${esc(title)}</div>` : ''}
        <div class="ui-callout__body">${body}</div>
      </div>
    </aside>`;
}

export function divider({ label } = {}) {
  return label
    ? `<div class="ui-divider"><span>${esc(label)}</span></div>`
    : '<hr class="ui-divider">';
}

export function avatar({ src, name = '', size = 40 } = {}) {
  if (src) return `<img class="ui-avatar" src="${esc(src)}" alt="${esc(name)}" width="${size}" height="${size}">`;
  return `<span class="ui-avatar ui-avatar--placeholder" style="--ui-avatar-size:${size}px">${esc(name.slice(0, 2).toUpperCase())}</span>`;
}

// Onglets : markup + enhance(root) pour la bascule. `content` est du HTML brut
// (déjà rendu par les autres composants).
export function tabs({ items = [], active } = {}) {
  if (!items.length) return '';
  const activeId = active || items[0].id;
  const list = items.map((it) => `
    <button type="button" role="tab" class="ui-tabs__tab${it.id === activeId ? ' is-active' : ''}"
      data-ui-tab="${esc(it.id)}" aria-selected="${it.id === activeId}" tabindex="${it.id === activeId ? 0 : -1}">
      ${esc(it.label)}
    </button>`).join('');
  const panels = items.map((it) => `
    <div role="tabpanel" class="ui-tabs__panel${it.id === activeId ? ' is-active' : ''}"
      data-ui-panel="${esc(it.id)}"${it.id === activeId ? '' : ' hidden'}>${it.content ?? ''}</div>`).join('');
  return `
    <div class="ui-tabs" data-ui-tabs>
      <div class="ui-tabs__list" role="tablist">${list}</div>
      <div class="ui-tabs__panels">${panels}</div>
    </div>`;
}

export function accordion(items = [], { name } = {}) {
  return `
    <div class="ui-accordion">
      ${items.map((it) => `
        <details class="ui-accordion__item"${name ? attr({ name }) : ''}>
          <summary class="ui-accordion__summary">${esc(it.title)}</summary>
          <div class="ui-accordion__body">${it.content ?? ''}</div>
        </details>`).join('')}
    </div>`;
}

export function timeline(events = []) {
  return `
    <ol class="ui-timeline">
      ${events.map((e) => `
        <li class="${toneClass('ui-timeline__item', e.tone)}">
          <div class="ui-timeline__marker" aria-hidden="true"></div>
          <div class="ui-timeline__content">
            ${e.date ? `<div class="ui-timeline__date">${esc(e.date)}</div>` : ''}
            ${e.title ? `<div class="ui-timeline__title">${esc(e.title)}</div>` : ''}
            ${e.text ? `<div class="ui-timeline__text">${e.text}</div>` : ''}
          </div>
        </li>`).join('')}
    </ol>`;
}

export function stepper(steps = [], { current = 0 } = {}) {
  return `
    <ol class="ui-stepper">
      ${steps.map((s, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-active' : '';
        const inner = `${s.href && i <= current ? `<a href="${esc(s.href)}">${esc(s.label)}</a>` : esc(s.label)}`;
        return `<li class="ui-stepper__item ${state}"><span class="ui-stepper__dot">${i < current ? '✓' : i + 1}</span>${inner}</li>`;
      }).join('')}
    </ol>`;
}

export function disclaimer(text, { className } = {}) {
  return `<p class="${cx('ui-disclaimer', className)}">${text}</p>`;
}

// Note de bas de page + son renvoi (petit numéro cliquable).
export function footnote(index, text) {
  return `${esc(text)}<a class="ui-footnote-ref" href="#fn-${index}" id="fnref-${index}"><sup>${index}</sup></a>`;
}

export function footnotes(list = []) {
  return `
    <ol class="ui-footnotes">
      ${list.map((text, i) => `<li id="fn-${i + 1}">${text}${list.length ? ` <a class="ui-footnote-back" href="#fnref-${i + 1}" aria-label="Retour">↩</a>` : ''}</li>`).join('')}
    </ol>`;
}

export { pctFmt as pct };
