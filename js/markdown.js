// Rendu Markdown des réponses, via @ts-stack/markdown.
//
// `sanitize: true` échappe le HTML brut et neutralise les liens `javascript:`
// (le modèle peut produire n'importe quoi). `breaks: true` transforme les
// sauts de ligne simples en `<br>`, comme dans une conversation.
import { Marked } from '@ts-stack/markdown';

Marked.setOptions({ sanitize: true, breaks: true });

export function renderMarkdown(src) {
  try {
    return Marked.parse(String(src ?? ''));
  } catch (err) {
    console.error('[clodo] markdown failed', err);
    return String(src ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
