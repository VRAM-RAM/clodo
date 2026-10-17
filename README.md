# Clodo

*Un assistant d'IA créé en France. Il tourne dans votre navigateur et explose ses concurrents sur tous les aspects !*


**Essayez-le ! [https://vram-ram.github.io/clodo/](https://vram-ram.github.io/clodo/) !**

> [!WARNING] 
> Clodo est un troll, dérivé de Claude (ce que j'estime assez évident).

Ici se trouve l'ensemble du code de **Clodo**. 


> [!NOTE]
> Clodo supporte le **WebGPU**, il est donc recommandé d'utiliser Clodo dans un navigateur compatible (Chrome par exemple)

Si vous voulez le faire tourner vous-même / comprendre l'architecture, lisez [INFOS.md](./INFOS.md).
\
\
**Atention** : `npm install` est requis pour le développement local : il installe `wllama`,
qui n'est pas commité (copié dans `js/vendor/wllama/` au `postinstall`).
\
\
Vous retrouverez la license [ici](./LICENSE). Les licenses des librairies Js sont dans [`/js/vendor`](./js/vendor/).
\
\
Pour les images, les logos, veuillez lire [THID_PARTY_LICENSE](./THIRD_PARTY_LICENSE).
\
\
Le modèle utilisé est [**Luth-LFM2-350M**](https://huggingface.co/kurakurai/Luth-LFM2-350M). Voici sa license : [https://huggingface.co/kurakurai/Luth-LFM2-350M/blob/main/LICENSE](https://huggingface.co/kurakurai/Luth-LFM2-350M/blob/main/LICENSE)

## Utilisation de l'agentique

Paradoxalement, **Clodo** a pas mal été codé par agentique, car :
- Le worker (`/js/worker.js`), la gestion du modèle dans `/js/model.js`, l'app et son style graphique (`/js/app.js` & `/css/style.css`) ont été répliqué depuis le site de Claude en utilisant aussi de l'agentique (mais bon, **qui** apprécie le *CSS* ?)
- Idem pour les composants dans `/js/ui/`.

Cependant :

- Les pages contenues dans `/js/pages/` ont été entièrement écrites à la main.
- Les textes (tous les textes) que contient l'ensemble des pages (même celles créées par agentique) ont été écrits à la main.
- Le backend rust est un mix des deux. Initialement, il est inspiré de [cet exemple candle](https://github.com/huggingface/candle/blob/main/candle-examples/src/chat_template.rs) et a été répliqué et modifié à la main, mais a beaucoup évolué, et ce entre autres par agentique.
