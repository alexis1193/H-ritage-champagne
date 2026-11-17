# Cartes réelles

Chaque carte est décrite par un fichier `cartes/<id>.json` (centre, taille de la fenêtre, parcelles du joueur) et importée par :

    npm run importer -- <id>        # écrit src/data/cartes/<id>.json

L'import télécharge (réseau nécessaire, une seule fois) :
- le relief : IGN RGE ALTI (data.geopf.fr, service WMS) ;
- bâtiments, routes, eau, végétation (dont les vignes), lieux-dits : IGN BD TOPO (data.geopf.fr, service WFS).

Le jeu ne télécharge rien : il lit le fichier JSON produit. `?carte=<id>` choisit la carte (par défaut `hautvillers`).

## Ajouter Épernay (avenue de Champagne)
1. Vérifier le centre dans `cartes/epernay.json` (latitude/longitude de l'avenue de Champagne) et la fenêtre (en mètres autour du centre).
2. Autoriser dans l'environnement : `data.geopf.fr` (déjà fait pour Hautvillers).
3. `npm run importer -- epernay`, puis ouvrir `?carte=epernay&debug`.
4. Régler dans le fichier de configuration les cibles de placement (`cibles` : maison, pressoir, cave, notaire, château, `cibleParcelles`) et la liste `parcelles` / `nomsParcelles`.
5. Les maisons de négoce de l'avenue sont réelles : le jeu garde la maison fictive « Delaunay & Fils » ; aucune vraie marque ne doit apparaître.
6. Si besoin, ajouter à `src/cartes/` des particularités (par exemple des bâtiments emblématiques à modéliser).

## Limites connues
- Les polygones de vigne de la BD TOPO sont des zones, pas des parcelles cadastrales : les rangs sont générés, orientés selon les courbes de niveau.
- Overpass (OpenStreetMap) n'était pas joignable depuis l'environnement de développement ; les données viennent donc de l'IGN. OpenStreetMap (Nominatim) n'a servi qu'à repérer l'abbatiale.
