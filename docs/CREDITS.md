# Crédits, sources et licences

À tenir à jour à chaque ajout de modèle 3D, son, texture ou donnée (règle du projet).

## Code et bibliothèques
| Élément | Licence | Remarque |
|---|---|---|
| Three.js (moteur 3D, dont l'objet « Sky » et les outils de fusion de géométries) | MIT | installé par npm |
| Vite, TypeScript, Vitest, Playwright | MIT / Apache-2.0 | outils de développement, non livrés au joueur |

## Textures
Toutes les textures actuelles (sol, crépi, pierre, tuiles, ardoises, eau, feuilles de vigne) sont **générées par le programme** (`src/world/textures.ts`). Aucun fichier externe, donc aucune licence à reprendre.
Si elles sont un jour remplacées par de vraies photos, noter ici chaque fichier avec sa source et sa licence. Sources envisagées, toutes en licence CC0 : ambientCG, Poly Haven.

## Données géographiques (étape « village réel », pas encore faite)
| Donnée | Source prévue | Licence | Obligation |
|---|---|---|---|
| Relief (altitudes) | IGN, RGE ALTI via la Géoplateforme (data.geopf.fr) | Licence ouverte Etalab 2.0 | mentionner la source et la date |
| Bâtiments, routes, rivière, parcelles de vigne | OpenStreetMap via Overpass | ODbL | mentionner « © contributeurs OpenStreetMap » ; les données dérivées restent sous ODbL |
| Limites des parcelles viticoles (si besoin) | Registre parcellaire graphique, data.gouv.fr | Licence ouverte Etalab 2.0 | mentionner la source |

## Modèles 3D et sons
Aucun pour l'instant (étape 7).
