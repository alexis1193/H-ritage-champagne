# Crédits, sources et licences

À tenir à jour à chaque ajout de modèle 3D, son, texture ou donnée (règle du projet).

## Code et bibliothèques
| Élément | Licence | Remarque |
|---|---|---|
| Three.js (moteur 3D, dont l'objet « Sky » et les outils de fusion de géométries) | MIT | installé par npm |
| Vite, TypeScript, Vitest, Playwright | MIT / Apache-2.0 | outils de développement, non livrés au joueur |

## Données géographiques (carte de Hautvillers)
| Donnée | Source | Licence | Mention à afficher |
|---|---|---|---|
| Relief (altitudes, pas de 5 m) | IGN, RGE ALTI®, via la Géoplateforme (service WMS, data.geopf.fr) | Licence Ouverte Etalab 2.0 | « Source : IGN, RGE ALTI® » |
| Bâtiments (contours, hauteurs), routes et chemins, cours d'eau et plans d'eau, zones de vigne et de bois, noms de lieux-dits | IGN, BD TOPO®, via la Géoplateforme (service WFS, data.geopf.fr) | Licence Ouverte Etalab 2.0 | « Source : IGN, BD TOPO® » |
| Position de l'abbatiale (centre de la carte) | OpenStreetMap, via Nominatim | ODbL 1.0 | « © contributeurs OpenStreetMap » (une seule coordonnée utilisée) |

Les données IGN ont été téléchargées par `scripts/importer-carte.mjs` puis converties dans `src/data/cartes/hautvillers.json` (simplification des contours, projection en mètres). Ce fichier est donc une œuvre dérivée : les mentions ci-dessus doivent figurer dans l'écran « À propos » du jeu (à ajouter) et sur la page de publication.

Note : Overpass (OpenStreetMap) n'a pas pu être utilisé (connexion refusée depuis l'environnement de développement). Si des bâtiments ou des rues OpenStreetMap sont ajoutés plus tard, ils restent sous ODbL (mention obligatoire, partage à l'identique pour la base dérivée).

## Textures photo (ambientCG, licence CC0 : libre, sans obligation, mention appréciée)
Source : https://ambientcg.com — chaque matière, couleur + relief (normales), réduite à 512 px (`public/textures/`).
| Fichier | Matière ambientCG | Usage |
|---|---|---|
| platre*.jpg | Plaster002 | murs, et grain de la craie au sol |
| tuile*.jpg | RoofingTiles014A | toits de tuiles |
| ardoise*.jpg | RoofingTiles001 | toits d'ardoise |
| pierre*.jpg | Rocks011 | pierre (abbatiale, soubassements) |
| asphalte*.jpg | Asphalt031 | routes |
| herbe*.jpg | Grass004 | herbe |
| ecorce*.jpg | Bark012 | écorce des arbres |

Textures générées par le programme (aucune licence à reprendre) : relief de l'eau, feuilles de vigne, rameaux de feuillus et branches de résineux (`src/world/textures.ts`).

## Modèles 3D et sons
Aucun pour l'instant (étape 7).
