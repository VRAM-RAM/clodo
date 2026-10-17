// clodo-ui · point d'entrée.
//
// Bibliothèque graphique maison de Clodo : composants, tableaux et graphiques
// SVG, sans dépendance, à l'image du thème éditorial du site. API principale :
//
//   import * as ui from '../ui/index.js';
//   app.innerHTML = ui.card({ title: 'ESG', body: ui.gauge({ value: 92 }) });
//   ui.enhance(app);   // active onglets + tri des tableaux

export * as format from './format.js';
export { SERIES, TONE, seriesColor, toneColor } from './theme.js';

export {
  barChart,
  stackedBar,
  hbarChart,
  lineChart,
  areaChart,
  sparkline,
  donutChart,
  radarChart,
  gauge,
} from './charts.js';

export {
  sectionHeader,
  card,
  badge,
  tag,
  delta,
  statTile,
  kpiGrid,
  callout,
  divider,
  avatar,
  tabs,
  accordion,
  timeline,
  stepper,
  disclaimer,
  footnote,
  footnotes,
  pct,
} from './components.js';

export { dataTable, comparisonTable, definitionList } from './tables.js';

// ---------------------------------------------------------------------------
// enhance(root) — branche l'interactivité légère (onglets, tri). Idempotent et
// sans effet si les éléments sont absents.
// ---------------------------------------------------------------------------
export function enhance(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('[data-ui-tabs]').forEach(setupTabs);
  root.querySelectorAll('table[data-ui-sortable]').forEach(setupSort);
}

function setupTabs(container) {
  if (container.__uiTabs) return;
  container.__uiTabs = true;

  const activate = (id, { focus = false } = {}) => {
    container.querySelectorAll('[data-ui-tab]').forEach((btn) => {
      const on = btn.dataset.uiTab === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      if (on && focus) btn.focus();
    });
    container.querySelectorAll('[data-ui-panel]').forEach((panel) => {
      const on = panel.dataset.uiPanel === id;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
  };

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ui-tab]');
    if (btn && container.contains(btn)) activate(btn.dataset.uiTab);
  });

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const list = [...container.querySelectorAll('[data-ui-tab]')];
    const idx = list.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    activate(list[next].dataset.uiTab, { focus: true });
  });
}

function setupSort(table) {
  if (table.dataset.uiEnhanced) return;
  table.dataset.uiEnhanced = 'true';
  const tbody = table.tBodies[0];
  if (!tbody) return;
  const headers = [...table.querySelectorAll('thead th')];

  table.querySelectorAll('th[data-ui-sort]').forEach((th) => {
    th.addEventListener('click', (e) => {
      if (!e.target.closest('.ui-table__sort')) return;
      const index = headers.indexOf(th);
      const isNum = th.dataset.sortType === 'num';
      const dir = th.getAttribute('aria-sort') === 'ascending' ? 'desc' : 'asc';
      const rows = [...tbody.rows];
      rows.sort((a, b) => {
        const va = sortKey(a, index, isNum);
        const vb = sortKey(b, index, isNum);
        const cmp = (isNum && typeof va === 'number' && typeof vb === 'number')
          ? va - vb
          : String(va).localeCompare(String(vb), 'fr');
        return dir === 'asc' ? cmp : -cmp;
      });
      rows.forEach((r) => tbody.appendChild(r));
      table.querySelectorAll('th[data-ui-sort]').forEach((h) => h.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
    });
  });
}

function sortKey(row, index, isNum) {
  const cell = row.cells[index];
  const raw = cell ? cell.getAttribute('data-sort-value') : '';
  if (isNum) return Number(raw);
  return String(raw);
}
