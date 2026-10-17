# clodo-ui

Bibliothèque d'interface **maison** du site Clodo : composants éditoriaux,
tableaux de données et graphiques SVG. Elle sert à construire les pages (impact,
benchmarks, transparence, etc.) avec un rendu cohérent, sobre et thémé.

## Arborescence des modules

| Module | Rôle |
| --- | --- |
| `format.js` | Échappement (`esc`), attributs (`attr`), classes (`cx`), formatage fr-FR (`num`, `pct`, `eur`, `date`), maths d'échelle (`niceScale`, `scale`, `clamp`, `sum`, `linePath`). |
| `theme.js` | Jetons de couleur : palette `SERIES`, tons `TONE`, `seriesColor`, `toneColor`. |
| `svg.js` | Primitives SVG internes : `svgEl`, `svgRoot`, `polar`, `pointsAttr`, `CHART`. **(non ré-exporté)** |
| `charts.js` | Les 9 graphiques (`barChart`, `stackedBar`, `hbarChart`, `lineChart`, `areaChart`, `sparkline`, `donutChart`, `radarChart`, `gauge`). |
| `components.js` | Briques éditoriales : en-têtes, cartes, badges, KPI, callouts, onglets, timeline, stepper, notes… |
| `tables.js` | `dataTable`, `comparisonTable`, `definitionList`. |
| `index.js` | Point d'entrée : ré-exports + `enhance(root)`. |

> Le module est **autonome** : `esc` est ré-implémenté dans `format.js` (et non
> importé de `app.js`) pour éviter tout import circulaire.

## Démarrage

```js
import * as ui from '../ui/index.js';

app.innerHTML = ui.card({
  title: 'Empreinte carbone',
  body: ui.kpiGrid([
    { label: 'Scope 1', value: '12', unit: ' tCO₂e', delta: { value: -8.4 } },
    { label: 'Scope 2', value: '3',  unit: ' tCO₂e', delta: { value: -21.0 } },
  ]) + ui.lineChart({
    labels: ['2023', '2024', '2025', '2026'],
    series: [{ name: 'Net Zero', values: [42, 30, 14, 3] }],
    title: 'Trajectoire Net Zero',
  }),
});

ui.enhance(app); // active onglets + tri des tableaux
```

`enhance(root)` doit être appelé **après** l'injection du HTML. Il est idempotent
et sans effet si les éléments concernés sont absents.

## Thème

### Palette catégorielle (`SERIES`)

| Jeton | Couleur | Usage |
| --- | --- | --- |
| `--chart-1` | terracotta (`--accent`) | accent principal, 1ʳᵉ série |
| `--chart-2` | sauge `#7f9a86` | 2ᵉ série |
| `--chart-3` | argile `#b08968` | 3ᵉ série |
| `--chart-4` | gris chaud `#9c9689` | séries neutres / comparaison |
| `--chart-5` | bleu-gris `#6f7d8c` | 5ᵉ série |
| `--chart-6` | sable `#c2a878` | 6ᵉ série |
| `--chart-grid` | grille des axes | lignes de fond |
| `--chart-axis` | ligne de base | axe |
| `--chart-track` | piste | fond de jauge/donut/barres |

### Tons sémantiques (`TONE`)

`accent`, `neutral`, `muted`, `positive`, `warning`, `danger`, `info` → pointent
vers `--ui-*` / `--muted`. Les composants acceptent en plus les tons
`success` et `warning`/`danger`/`info` (voir chaque composant).

### Surcharger le thème

Il suffit de redéfinir les variables dans le scope voulu :

```css
.theme-print {
  --chart-1: #2b6cb0;
  --chart-2: #2f855a;
}
```

```js
seriesColor(0);          // -> "var(--chart-1)"
toneColor('danger');     // -> "var(--ui-danger)"
toneColor('#e11');       // couleur CSS passée telle quelle
```

---

## `format`

### `esc(value)`
Échappe `& < > " '`. Tolère `null`/`undefined` (`''`).

```js
esc('<b>"x"</b>'); // &lt;b&gt;&quot;x&quot;&lt;/b&gt;
```

### `attr(map)`
Sérialise un objet en attributs HTML. `null`/`undefined`/`false` → ignorés ;
`true` → attribut booléen nu.

```js
attr({ hidden: true, id: 'x', title: null }); // 'hidden id="x"'
```

### `cx(...names)`
Concatène des classes en filtrant les valeurs falsy.

```js
cx('ui-card', false && 'ui-card--x', 'foo'); // 'ui-card foo'
```

### `num(value, { decimals, compact, sign })`
Nombre au format `fr-FR`. `decimals` = décimales fixes ; `compact` = `1,2 k` ;
`sign` = signe explicite. Non-fini → `'—'`.

```js
num(12345.6, { decimals: 1 }); // "12 345,6"
num(12500, { compact: true }); // "12,5 k"
```

### `pct(ratio, { fromPercent, decimals, compact, sign, space })`
Ratio `0..1` → pourcentage. `fromPercent: true` si la valeur est déjà en `%`.
`space: false` supprime l'espace insécable avant `%`.

```js
pct(0.42);                 // "42 %"
pct(42, { fromPercent: true });
```

### `eur(value, { decimals, compact })`
Montant en euros (`\u00a0€`). `compact` → `1,2 M€`.

### `date(value, opts)`
Date longue fr-FR (`date('2026-01-05')` → `5 janvier 2026`). `opts` est passé à
`Intl.DateTimeFormat`.

### `niceScale(min, max, ticks = 5)`
Arrondit un intervalle et calcule des paliers lisibles.
Renvoie `{ min, max, step, ticks: number[] }`. Utilisé par les axes de tous les
graphiques ; utile pour aligner plusieurs graphiques sur la même échelle.

### `scale(value, d0, d1, r0, r1)`
Projette `value` de `[d0, d1]` vers `[r0, r1]`. Renvoie `r0` si `d0 === d1`.

### `clamp(value, lo, hi)`
Borne une valeur.

### `sum(list)`
Somme tolérante aux non-nombres.

### `linePath(points)`
Construit un `d` SVG de type ligne depuis `[[x, y], …]`.

---

## Graphiques

Tous renvoient un `<svg>` **responsive** (`viewBox` + `preserveAspectRatio`).
Options communes :

| Option | Défaut | Notes |
| --- | --- | --- |
| `width`, `height` | `640 × 260` (`CHART`) | unités viewBox |
| `className` | `'ui-chart'` | classe CSS |
| `title`, `desc` | — | accessibilité : `<title>`/`<desc>` + `role="img"` |

Une **série** peut être :

- un tableau de nombres → nom auto + couleur `seriesColor(i)` ;
- un objet `{ name, values, tone | color }` (`color` CSS prioritaire, sinon `tone`).

Chaque graphique vide (données absentes) renvoie un placeholder `ui-chart--empty`.

### `barChart({ labels, series, stacked, legend, … })`
Barres verticales, groupées par défaut. `stacked: true` empile les séries.
`legend: true` affiche la légende (en haut à droite). `unit` est ajoutée aux
graduations de l'axe Y (ex. `' s'`).

```js
barChart({
  labels: ['2024', '2025', '2026'],
  series: [
    { name: 'Scope 1', values: [12, 9, 6], tone: 'danger' },
    { name: 'Scope 2', values: [8, 5, 3] },
  ],
  unit: ' tCO₂e',
  legend: true,
  title: 'Émissions par scope',
});
```

**Valeurs négatives** : le domaine inclut toujours `0`, la ligne de base se
place au zéro et les barres négatives descendent (les empilements gèrent des
accumulateurs positifs et négatifs séparés). Si toutes les valeurs sont ≥ 0, le
rendu est identique au cas classique.

```js
barChart({ labels: ['A', 'B'], series: [{ name: 'Écart', values: [-12, 6] }] });
```

### `stackedBar(opts)`
Raccourci de `barChart({ ...opts, stacked: true })`.

### `hbarChart({ items, min, max, unit, … })`
Barres horizontales (classements). `items` = `[{ label, value, highlight }]`.
`highlight: true` colore la barre en `--chart-1` (sinon `--chart-4`). La hauteur
s'adapte au nombre de lignes si `height` est omis.

```js
hbarChart({
  items: [
    { label: 'Clodo', value: 1, highlight: true },
    { label: 'Autres', value: 12 },
  ],
  unit: ' pt',
  title: 'Classement',
});
```

**Valeurs négatives** : le domaine inclut `0`, une **ligne d'axe verticale** se
dessine au zéro et les barres divergent — positives vers la **droite**,
négatives vers la **gauche**. La marge gauche s'élargit automatiquement pour
loger les libellés négatifs ; `min`/`max` forcent les bornes (miroirs, optionnels).

```js
hbarChart({
  unit: ' %',
  items: [
    { label: 'Scope 3', value: -18 },
    { label: 'Scope 1', value: 7, highlight: true },
    { label: 'Compensation', value: 22 },
  ],
  title: 'Variation signée',
});
```

Si toutes les valeurs sont ≥ 0, le rendu est identique au cas classique (zéro à
gauche, pas de ligne d'axe).

### `lineChart({ labels, series, area, points, unit, … })`
Lignes. `area: true` remplit sous la courbe ; `points: false` masque les points ;
`unit` est ajoutée aux graduations de l'axe Y (ex. `' s'`). Légende affichée
automatiquement dès 2 séries.

### `areaChart(opts)`
Raccourci de `lineChart({ ...opts, area: true })`.

### `sparkline({ values, tone, width = 160, height = 44 })`
Mini-courbe + aire, sans axes ni grille. Idéale dans un `statTile` (`spark`) ou
une cellule de tableau (type `spark`).

### `donutChart({ segments, center, size = 200, thickness = 28 })`
Anneau. `segments` = `[{ label, value, tone | color }]`. `center` =
`{ value, label }` affiché au milieu.

```js
donutChart({
  segments: [
    { label: 'Recyclé', value: 82, tone: 'positive' },
    { label: 'Neuf', value: 18 },
  ],
  center: { value: '82 %', label: 'circularité' },
});
```

### `radarChart({ axes, series, max, size = 280, levels = 4 })`
Toile d'araignée (≥ 3 axes). `axes` = libellés ; `series` = séries de valeurs
(sur la même échelle, sinon `max`).

### `gauge({ value, max = 100, label, sublabel, size = 220, thickness = 18, tone })`
Demi-jauge. `label` remplace l'affichage numérique ; `sublabel` en dessous.

---

## Composants

Tous acceptent souvent un `className`/`tone`. Les champs qui attendent du **HTML
déjà rendu** sont indiqués « HTML brut » ; les autres sont **échappés**.

### `sectionHeader({ eyebrow, title, sub, align = 'left', className })`
En-tête de section éditorial. `title` est **HTML brut** (permet `<em>…</em>`),
`eyebrow`/`sub` sont échappés. `align` ∈ `left|center`.

### `card({ title, subtitle, actions, body, footer, tone, className, id })`
Carte. `title`/`subtitle` échappés ; `body`, `actions`, `footer` = **HTML brut**.

### `badge({ text, tone })`
Étiquette arrondie. Tons : `accent`, `neutral`, `muted`, `info`, `success`,
`warning`, `danger`.

### `tag(text, { tone })`
Étiquette (style proche du badge, à distinguer visuellement selon l'usage).

### `delta(value, { direction, decimals = 1, suffix = ' %' })`
Variation avec flèche ▲/▼. `direction` (`up`/`down`) forcé si besoin.

```js
delta(-8.4);        // ▼ -8,4 %
delta(2, { direction: 'up', suffix: ' pts' });
```

### `statTile({ label, value, unit, delta, hint, tone, spark })`
Brique KPI : `delta` accepte un objet (`{ value, decimals, … }`) ou une chaîne
(HTML brut) ; `spark` = HTML brut (ex. `sparkline(...)`).

### `kpiGrid(items, { className })`
Grille de tuiles. Chaque item est soit un objet `statTile`, soit une chaîne
(HTML brut).

### `callout({ tone = 'info', title, body, className })`
Encart. Icône automatique selon le ton (`info ℹ`, `success ✓`, `warning !`,
`danger ⚠`). `body` = HTML brut. `role="note"`.

### `divider({ label })`
Séparateur ; avec `label`, une ligne de titre.

### `avatar({ src, name, size = 40 })`
Avatar image (`src`) ou initiales (2 lettres) en repli.

### `tabs({ items, active })`
Onglets accessibles (rôles `tablist`/`tab`/`tabpanel`). `items` =
`[{ id, label, content }]` ; `content` = HTML brut. **Nécessite `enhance()`**
pour la bascule (clic + flèches gauche/droite).

### `accordion(items, { name })`
`<details>` natifs. `items` = `[{ title, content }]`. `name` regroupe (natif).

### `timeline(events)`
Frise verticale. `events` = `[{ date, title, text, tone }]`.

### `stepper(steps, { current = 0 })`
Étapes numérotées ; `steps` = `[{ label, href }]` (lien cliquable jusqu'à
l'étape courante).

### `disclaimer(text, { className })`
Paragraphe de décharge. `text` = HTML brut (permet le gras/liens).

### `footnote(index, text)` / `footnotes(list)`
Note de bas de page et son renvoi. `footnote(i, text)` insère le texte + le
petit numéro cliquable ; `footnotes([...])` rend la liste, avec liens retour.

### `pct`
Ré-export de `format.pct` pour commodité.

---

## Tableaux

### `dataTable({ columns, rows, caption, className, sortable, totals })`

Colonnes : `{ key, label, type, align, tone, format }`.
Types : `text` (défaut, échappé), `num`, `badge`, `delta`, `spark`, `raw`
(HTML brut). L'alignement par défaut des `num` est `right`.

Lignes : tableau de valeurs alignées sur `columns`, **ou** objet indexé par
`col.key`.

`sortable: true` active le **tri** (via `enhance()`) : chaque `th` devient un
bouton, `aria-sort` est maintenu, le tri se fait sur `data-sort-value`
(échappé) — `num` en numérique, sinon `localeCompare('fr')`.

`totals` : tableau de cellules de pied de tableau (échappées).

```js
dataTable({
  columns: [
    { key: 'name', label: 'Critère' },
    { key: 'score', label: 'Score', type: 'num', format: { decimals: 1 } },
    { key: 'trend', label: '6 mois', type: 'spark' },
    { key: 'status', label: 'Statut', type: 'badge' },
  ],
  rows: [
    { name: 'Émissions', score: 4.2, trend: ui.sparkline({ values: [9, 7, 5, 4] }), status: 'En cours' },
  ],
  sortable: true,
  caption: 'Indicateurs',
});
```

### `comparisonTable({ columns, rows, caption, className })`
Comparatif ✓/✗. `columns` = `[{ key, label, highlight }]`, `rows` =
`[{ label, values }]` avec `values[key]` valant `true`/`false` (→ ✓/✗ avec
`aria-label`), `null` (→ `—`), une chaîne, ou `{ ok, text }`. `1ʳᵉ` colonne =
en-têtes de ligne. `highlight: true` met une colonne en avant.

### `definitionList(items, { className })`
Liste de définitions. `items` = `[{ term, desc }]` (`desc` = HTML brut).

---

## Interactivité : `enhance(root)`

Branche l'interactivité légère sur un sous-arbre (par défaut `document`).
Idempotent (marqueurs internes) et no-op si rien à faire.

| Sélecteur | Effet |
| --- | --- |
| `[data-ui-tabs]` | Bascule des `[data-ui-tab]` / `[data-ui-panel]` au clic, navigation `←`/`→`, `aria-selected` + `tabindex` gérés. |
| `table[data-ui-sortable]` | Tri par `th[data-ui-sort]` (clic sur `.ui-table__sort`), `aria-sort` maintenu, `↕` via `.ui-table__caret`. |
| `[data-ui-tooltip]` | Info-bulle **purement CSS** (aucun JS requis). |

Ces attributs sont **produits automatiquement** par `tabs()` et
`dataTable({ sortable: true })` : en pratique, contentez-vous d'appeler
`enhance(racine)` après le rendu.

---

## Accessibilité

- **SVG** : `role="img"` ; `<title>`/`<desc>` injectés si fournis, sinon
  `aria-hidden="true"` (graphique décoratif). Pensez à renseigner `title`/`desc`
  pour les graphiques porteurs d'information.
- **Tableaux** : `<caption>`, `th[scope]`, `aria-sort`, valeurs triées exposées
  via `data-sort-value`.
- **Marques** : ✓/✗ avec `aria-label="oui"/"non"`.
- **Onglets** : rôles ARIA complets, `tabindex` roving.
- **Animations** : `prefers-reduced-motion` neutralise les transitions.

## Classes CSS (`.ui-*`)

`ui-section`, `ui-card` (+ `__head/__title/__subtitle/__actions/__body/__foot`),
`ui-badge`, `ui-tag`, `ui-delta` (`--up/--down`), `ui-stat` (+ `__label/__value/
__unit/__delta/__spark/__hint`), `ui-kpis`, `ui-callout` (+ `__icon/__title/
__body`), `ui-divider`, `ui-avatar` (`--placeholder`), `ui-tabs` (+ `__list/__tab/
__panels/__panel`), `ui-accordion` (+ `__item/__summary/__body`), `ui-timeline`
(+ `__item/__marker/__content/__date/__title/__text`), `ui-stepper` (+ `__item/
__dot`), `ui-disclaimer`, `ui-footnote-ref`, `ui-footnotes`, `ui-footnote-back`,
`ui-table` (+ `__wrap/__caption/__head/__th/__sort/__caret/__body/__row/__td/
__num/__foot`), `ui-table--compare`, `ui-mark` (`--yes/--no/--none`), `ui-defs`
(+ `__row/__term/__desc`), `ui-chart` (`--empty`), `ui-sparkline`.

États : `is-active`, `is-done`, `is-highlight`, `is-sortable`.

## Tests

```sh
node /var/folders/.../domtest/uitest.mjs
```

`uitest.mjs` couvre le formatage, la géométrie des 9 graphiques,
l'échappement, les composants, les tableaux et `enhance` (onglets + tri) en
jsdom. Les tests tirant `app.js`/`model.js` nécessitent le loader
(`node --import ./hooks.mjs <test>.mjs`).

> **Démo visuelle.** `js/pages/styleguide.js` (`renderStyleguide()`) reste
> disponible comme galerie de composants, mais sa route `#/styleguide` est
> **débranchée** de `js/app.js`. Pour la réactiver, réimporter `renderStyleguide`
> et `enhance`, puis rendre la page sur ce hash.
