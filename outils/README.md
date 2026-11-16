# Sources découpées de COPO (proposition)

`index.html` contient toute l'application : environ 10 000 lignes, 1,7 Mo, dont des lignes de données
de plus de 80 000 caractères. Ces outils permettent de travailler sur des fichiers plus petits,
**sans rien changer pour l'utilisateur** : COPO reste un seul `index.html`, qui marche ouvert depuis
le disque, hors ligne, avec le calcul en tâche de fond (qui lit le script intégré à la page).

```
src/
├─ page.html                  la page (166 Ko au lieu de 1,7 Mo)
├─ css/                       la feuille de style en 16 parties : 010-theme-sombre.css, 020-theme-clair.css,
│                             030-barre-du-haut.css, 040-zone-de-travail.css, 070-dialogues.css, …
├─ js/                        le script principal, une section par fichier, rangée par domaine :
│  ├─ base/                   démarrage, langue, unités, calques, historique, calcul des parcours, menus
│  ├─ noyau/                  géométrie, profil, poche, V-carving, relief, perçage, ponts, arcs, G-code,
│  │                          post-processeurs (zone CORE-START … CORE-END, reprise par la tâche de fond)
│  ├─ dessin/                 vue 2D, outils de dessin, accrochage, souris, opérations, lissage, rotation
│  ├─ fichiers/               import SVG / DXF / PDF, polices, bibliothèque de dessins, vectorisation
│  ├─ usinage/                panneaux Parcours, Outils et G-code, bibliothèque d'outils, fiche de gamme, machines
│  ├─ relief/                 modélisation 2,5D, vues 2D / 3D
│  ├─ extensions/             boîte à entures, graduations, touche de guitare, incrustations
│  └─ aide/                   schémas, infobulles, accueil et visite, signaler un bug
├─ donnees/                   les lignes de données très longues
│  ├─ vposts.js               post-processeurs Vectric (87 Ko sur une ligne)
│  ├─ default-lib-json.js     bibliothèque d'outils par défaut
│  └─ sample-project.js, sample-rotary.js, …
└─ i18n/
   └─ en.json                 les traductions anglaises : texte français → texte anglais,
                              triées, une par ligne (auparavant 176 blocs Object.assign)
```

Les sections JS sont celles que le code marque déjà par `// ---------- titre ----------`, et les
parties CSS commencent aux titres déjà présents dans la feuille de style (`/* top bar */`, `/* dialog */`…) :
le découpage suit l'organisation existante, il n'invente rien. Les fichiers sont numérotés de 10 en 10
pour pouvoir en insérer un entre deux ; **l'ordre d'assemblage est celui des numéros**, tous dossiers
confondus (il compte : en CSS, la règle placée plus bas l'emporte ; en JS, le code s'exécute dans l'ordre).
Le rangement en dossiers n'est qu'une commodité de lecture : un fichier peut changer de dossier sans
rien changer à `index.html`. Les règles de rangement (`RANGEMENT`) et de coupe du CSS (`COUPES_CSS`)
sont en tête de `decouper.js`.

## Les deux outils (Node.js 18 ou plus, aucune dépendance)

```
node outils/decouper.js                 index.html → src/   (vérifie que l'aller-retour est exact)
node outils/assembler.js                src/ → index.html
node outils/assembler.js --verifier     index.html correspond-il à src/ ? (code de sortie 1 sinon)
node outils/assembler.js --surveiller   réassemble index.html à chaque enregistrement d'un fichier de src/
```

**Garantie** : `decouper.js` réassemble `src/` en mémoire et le compare à `index.html` ; à la moindre
différence, il s'arrête en erreur. Tout est identique à l'octet près, sauf la zone des traductions :
les 176 blocs `Object.assign(I18N_EN, {…})` deviennent une seule déclaration `const I18N_EN = {…}`,
une traduction par ligne. Pour celle-ci, `decouper.js` exécute les anciens blocs et la nouvelle
déclaration et vérifie que les deux dictionnaires sont identiques. Vérifié aussi dans Chrome :
mêmes textes affichés en français et en anglais, et même G-code (tests de `tests/`).

## Traductions

`src/i18n/en.json` associe chaque texte français à sa traduction anglaise : c'est le principe de
gettext, le texte français sert de clé (`tr('Ouvrir un projet…')`, et la page est traduite
automatiquement). Pour traduire un nouveau texte, on ajoute une ligne à `en.json`.

```
node outils/i18n.js            résumé
node outils/i18n.js --detail   chaque texte concerné, avec son fichier et sa ligne
node outils/i18n.js --strict   code de sortie 1 s'il reste un texte non traduit
```

L'outil signale :
- les textes qui **resteraient en français** dans l'interface anglaise : ceux passés à `tr()` / `trf()`
  et ceux de la page (contenu, `title`, `aria-label`, `placeholder`). La traduction est calculée avec
  le même algorithme que `tr()`, et un mot déjà présent dans les traductions anglaises (« Machine »,
  « Relief »…) n'est pas compté comme français : seuls les vrais oublis restent ;
- les traductions **probablement inutilisées**, dont le texte n'apparaît nulle part dans `src/`
  (à vérifier avant de les supprimer : un texte peut être construit par morceaux).

## Façon de travailler

1. modifier un fichier de `src/` (ou laisser tourner `node outils/assembler.js --surveiller`) ;
2. `node outils/assembler.js` pour mettre `index.html` à jour, puis recharger la page ;
3. commiter `src/` **et** `index.html` : le site GitHub Pages et le téléchargement ZIP restent inchangés.

Dans l'historique Git, une modification apparaît alors dans un petit fichier au nom parlant
(`src/js/570-panneau-g-code.js`) au lieu d'une ligne quelque part dans 1,7 Mo.

`node outils/assembler.js --verifier` signale un `index.html` modifié directement sans passer par `src/`.
Tant que la transition n'est pas décidée, `decouper.js` peut être relancé sur n'importe quelle version
d'`index.html` : rien n'est à maintenir à la main.
