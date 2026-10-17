// clodo-ui · tableaux de données (HTML sémantique).
//
// `dataTable` gère plusieurs types de colonnes et, si demandé, le tri via
// enhance(). Les valeurs sont échappées par défaut ; seul le type `raw`
// insère du HTML déjà rendu (composants ui).

import { esc, cx, num } from './format.js';
import { badge, delta as deltaComp } from './components.js';

function cellValue(value, col) {
  switch (col.type) {
    case 'num': {
      const n = Number(value);
      return `<span class="ui-table__num">${Number.isFinite(n) ? esc(num(n, col.format)) : '—'}</span>`;
    }
    case 'badge':
      return value == null ? '—' : badge({ text: value, tone: col.tone });
    case 'delta': {
      const v = typeof value === 'object' && value !== null ? value : { value };
      return deltaComp(v.value, v);
    }
    case 'spark':
    case 'raw':
      return value == null ? '' : value;
    default:
      return value == null ? '' : esc(value);
  }
}

function cellSortValue(value, col) {
  if (col.type === 'num') return Number(value);
  const v = typeof value === 'object' && value !== null ? value.value : value;
  return typeof v === 'string' ? v.toLowerCase() : v;
}

export function dataTable({
  columns = [],
  rows = [],
  caption,
  className,
  sortable = false,
  totals,
} = {}) {
  const head = columns.map((col) => {
    const align = col.align || (col.type === 'num' ? 'right' : 'left');
    if (!sortable) {
      return `<th scope="col" class="ui-table__th" style="text-align:${align}">${esc(col.label)}</th>`;
    }
    return `<th scope="col" class="ui-table__th is-sortable" style="text-align:${align}" data-ui-sort="${esc(col.key)}" data-sort-type="${esc(col.type || 'text')}" aria-sort="none">
      <button type="button" class="ui-table__sort">${esc(col.label)}<span class="ui-table__caret" aria-hidden="true"></span></button>
    </th>`;
  }).join('');

  const body = rows.map((row) => {
    const cells = columns.map((col) => {
      const value = Array.isArray(row) ? row[columns.indexOf(col)] : row[col.key];
      const align = col.align || (col.type === 'num' ? 'right' : 'left');
      return `<td class="ui-table__td" style="text-align:${align}" data-sort-value="${esc(cellSortValue(value, col))}">${cellValue(value, col)}</td>`;
    }).join('');
    return `<tr class="ui-table__row">${cells}</tr>`;
  }).join('');

  const foot = totals
    ? `<tfoot class="ui-table__foot"><tr>${totals.map((v, i) => `<td class="ui-table__td" style="text-align:${columns[i]?.align || 'left'}">${v == null ? '' : esc(v)}</td>`).join('')}</tr></tfoot>`
    : '';

  return `
    <div class="${cx('ui-table-wrap', className)}">
      <table class="ui-table"${sortable ? ' data-ui-sortable' : ''} data-ui-table>
        ${caption ? `<caption class="ui-table__caption">${esc(caption)}</caption>` : ''}
        <thead class="ui-table__head"><tr>${head}</tr></thead>
        <tbody class="ui-table__body">${body}</tbody>
        ${foot}
      </table>
    </div>`;
}

function mark(value) {
  if (value === true) return '<span class="ui-mark ui-mark--yes" aria-label="oui">✓</span>';
  if (value === false) return '<span class="ui-mark ui-mark--no" aria-label="non">✗</span>';
  if (value == null) return '<span class="ui-mark ui-mark--none">—</span>';
  if (typeof value === 'object') {
    return `<span class="ui-mark ${value.ok ? 'ui-mark--yes' : 'ui-mark--no'}">${esc(value.text || (value.ok ? '✓' : '✗'))}</span>`;
  }
  return `<span class="ui-mark">${esc(value)}</span>`;
}

export function comparisonTable({ columns = [], rows = [], caption, className } = {}) {
  const head = `<th scope="col" class="ui-table__th"></th>`
    + columns.map((col) => `<th scope="col" class="${cx('ui-table__th', 'is-center', col.highlight && 'is-highlight')}">${esc(col.label)}</th>`).join('');

  const body = rows.map((row) => {
    const cells = columns.map((col) => {
      const value = row.values ? row.values[col.key] : undefined;
      return `<td class="${cx('ui-table__td', 'is-center', col.highlight && 'is-highlight')}">${mark(value)}</td>`;
    }).join('');
    return `<tr class="ui-table__row"><th scope="row" class="ui-table__th ui-table__th--row">${esc(row.label)}</th>${cells}</tr>`;
  }).join('');

  return `
    <div class="${cx('ui-table-wrap', 'ui-table-wrap--compare', className)}">
      <table class="ui-table ui-table--compare" data-ui-table>
        ${caption ? `<caption class="ui-table__caption">${esc(caption)}</caption>` : ''}
        <thead class="ui-table__head"><tr>${head}</tr></thead>
        <tbody class="ui-table__body">${body}</tbody>
      </table>
    </div>`;
}

export function definitionList(items = [], { className } = {}) {
  return `
    <dl class="${cx('ui-defs', className)}">
      ${items.map((it) => `<div class="ui-defs__row"><dt class="ui-defs__term">${esc(it.term)}</dt><dd class="ui-defs__desc">${it.desc ?? ''}</dd></div>`).join('')}
    </dl>`;
}
