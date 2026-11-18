# Héritage en Champagne — règles du projet

Source de vérité : `docs/GDD.md` (à relire avant chaque étape).
Utilisateur : Alexis, non développeur, travaille depuis son téléphone. Expliquer simplement, en français.

## Règles
- **Langue** : tout texte du jeu est en français. Ton chaleureux, précis, jamais moralisateur ; on parle du métier, pas de consommation d'alcool.
- **Stack** : TypeScript + Vite + Three.js. Publication GitHub Pages (`base` Vite = `./`).
- **Séparation stricte** : la simulation vit dans `src/sim/` (TypeScript pur, aucun import de Three.js ni du DOM). L'affichage ne contient aucune règle de jeu.
- **Chiffres d'équilibrage** : uniquement dans `src/data/*.json`, jamais en dur dans le code. Textes éducatifs dans `src/data/textes.json`.
- **Priorité téléphone** : paysage d'abord, portrait supporté, monde 3D ≥ 75 % de l'écran, texte ≥ 15 px, boutons ≥ 44 px, barre du haut ≤ 40 px.
- **Tests obligatoires** : Vitest pour chaque règle de `src/sim/` (`npm test`).
- **Captures Playwright** après chaque changement d'interface : 360×800, 390×844, 768×1024, 1280×720, paysage et portrait. Regarder les images et corriger avant de rendre la main.
- **Performance** : 30 images/s mini sur Android milieu de gamme, chargement < 15 Mo.
- **Licences** : chaque modèle 3D / son listé avec sa licence dans `docs/CREDITS.md`.
- Tous les textes éducatifs sont relus par Alexis avant publication.

## Carte réelle (depuis l'étape 1 bis)
- Le monde est la **vraie carte de Hautvillers** à l'échelle 1:1 (données IGN, voir `docs/CREDITS.md`), lue dans `src/data/cartes/<id>.json`, produite par `npm run importer -- <id>` à partir de `cartes/<id>.json`. Le jeu ne télécharge aucune donnée en jeu.
- Lieux du jeu : ids `maison`, `eglise`, `pressoir`, `cave`, `notaire`, `chateau` (fictif), `loge` (fictive), `parcelle1..5`. Aucune vraie marque de champagne : la maison de négoce reste « Delaunay & Fils ».
- Deuxième carte prévue : Épernay (`cartes/epernay.json`, `?carte=epernay`), mode d'emploi dans `cartes/README.md`.
- Ne jamais committer `donnees-brutes/` (cache de l'import). Import : réseau limité aux domaines autorisés (data.geopf.fr, ambientcg.com...).

## Simulation (étape 2)
- Règles dans `src/sim/` (TypeScript pur), chiffres dans `src/data/*.json`. `npm run simuler -- [parties] [années]` rejoue des parties automatiques (4 profils) ; `npm test` contient les tests de chaque règle et les gardiens d'équilibrage. Voir `docs/EQUILIBRAGE.md` pour ce qui a été réglé et pourquoi.

## Interface de jeu (étape 3)
- `src/jeu.ts` : partie en cours + sauvegarde automatique (localStorage). `src/panneaux.ts` : panneaux (parcelle, fin du mois, résumé, maison, sauvegarde) qui appellent les actions de `src/sim`. Le résumé de fin de mois s'affiche toujours (rythme). Textes dans `src/data/textes.json` (à relire par Alexis).
- Décor lié à la partie : saison, givre, pluie/grêle selon les événements, cueilleurs en septembre, piquets colorés par statut de parcelle.

## Commandes
- `npm run captures` : captures Playwright (après `npm run build`) dans `captures/`, à regarder une par une. Navigateur préinstallé utilisé via /opt/pw-browsers/chromium (ne pas réinstaller Playwright). Le FPS mesuré en rendu logiciel n est pas représentatif d un téléphone.
- Options d adresse du jeu : `?debug` (compteur d images/s), `?mois=0..11` (avance la partie jusqu'à ce mois, sans rien faire), `?nouvelle` (ignore la sauvegarde), `?qualite=basse|moyenne|haute`, `?fixe` (désactive la qualité adaptative, utilisé par les captures).
- `npm run dev` : serveur local · `npm run build` : build · `npm test` : tests Vitest · `npm run typecheck`
