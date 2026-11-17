# Héritage en Champagne — Document de conception

17 novembre 2026 · Alexis Gallez

## Démarrer avec Claude Code depuis le téléphone

Tout se fait depuis le téléphone : Claude Code tourne dans l'app Claude (onglet Code) sur un dépôt GitHub, dans un ordinateur dans le cloud. Alexis donne les consignes, Claude Code code, teste et publie ; Alexis joue au résultat dans le navigateur de son téléphone.

Si l'installation des outils échoue (npm), c'est l'accès réseau de l'environnement : il faut autoriser l'installation de paquets dans les réglages de l'environnement Claude Code. Le jeu reste en web (et pas Godot) parce qu'un projet web se construit, se teste et se publie entièrement depuis le téléphone.

## Vision du jeu

*Héritage en Champagne* est un jeu de gestion en 3D où le joueur reprend les 2 ha de vigne de ses parents, livreurs de raisins pour une grande maison, et en fait une maison de champagne. Il doit apprendre le vrai métier en le faisant : chaque geste du vigneron et du chef de cave est expliqué.

- **Public** : grand public curieux de champagne, clients du bar à champagne mobile, amateurs de jeux de gestion. Aucune connaissance nécessaire.
- **Plateformes** : téléphone et tablette d'abord (paysage et portrait), ordinateur ensuite. Jeu web, sans installation.
- **Rythme** : lent et posé. Un mois de jeu dure 3 à 6 minutes, une année environ 45 minutes. Le temps n'avance jamais tout seul.
- **Promesse** : se sentir en Champagne (coteaux, craie, village, saisons) et repartir en sachant comment on fait une bouteille.
- **Deux modes** : la partie complète, mois par mois, sauvegardée ; puis plus tard un mode « Défi du bar » de 10 minutes avec classement, pour les événements.
- **Ton** : chaleureux, précis, jamais moralisateur. On parle du métier, pas de consommation d'alcool.

## Choix techniques

Le jeu est un projet web en TypeScript avec Three.js, publié sur GitHub Pages. La règle d'or : la simulation (règles, chiffres) est totalement séparée de l'affichage 3D, pour pouvoir la tester et l'équilibrer sans écran.

| Sujet | Choix | Pourquoi |
| --- | --- | --- |
| Moteur 3D | Three.js installé par npm | Tourne dans tout navigateur de téléphone |
| Langage et outil | TypeScript + Vite | Erreurs détectées avant de jouer, build rapide |
| Modèles 3D | glTF low-poly libres de droits (Kenney, Quaternius, Poly Pizza), licence vérifiée une par une | Vrais bâtiments, arbres, personnages au lieu de cubes |
| Simulation | Module `src/sim/` en TypeScript pur, sans Three.js | Testable en ligne de commande |
| Chiffres d'équilibrage | Fichiers `src/data/*.json` | On règle le jeu sans toucher au code |
| Tests | Vitest pour la simulation, Playwright pour des captures d'écran à plusieurs tailles de téléphone | Claude Code voit l'écran et corrige lui-même |
| Sauvegarde | localStorage + code d'export à copier | Reprendre sa partie, la changer d'appareil |
| Publication | GitHub Pages, à chaque étape validée | Un lien à ouvrir sur le téléphone |

Objectifs de performance : 30 images par seconde minimum sur un téléphone Android milieu de gamme, chargement initial sous 15 Mo, premier écran en moins de 5 secondes en 4G.

## Univers, carte et graphismes

Le jeu se passe à **Hautvillers** (Marne), le village de l'abbaye où l'on associe le nom de Dom Pérignon, sur les coteaux de la vallée de la Marne, près d'Épernay. La carte est **réelle** : relief (IGN RGE ALTI), bâtiments, routes, cours d'eau, vignes et bois (IGN BD TOPO) à l'échelle 1:1, de la forêt domaniale au nord jusqu'à la Marne et au canal latéral, à environ un kilomètre au sud. Le joueur doit reconnaître la Champagne au premier coup d'œil : coteaux couverts de rangs de vigne qui suivent les courbes de niveau, forêt au sommet, craie blanche dans les chemins, clocher d'ardoise, la Marne en contrebas. Voir `docs/CREDITS.md` pour les sources.

Ce qui est réel : le village, les rues, les bâtiments (formes et hauteurs), les vignes et les bois, la Marne, l'abbatiale, les noms des lieux-dits. Ce qui est inventé : le jeu lui-même (parcelles du joueur, maison familiale, pressoir, cave, notaire), la Maison Delaunay & Fils (maison de négoce fictive, aucune vraie marque) et la loge de vigne. Les cinq parcelles du joueur sont posées sur de vraies zones de vigne près du village ; elles prennent le nom du lieu-dit réel le plus proche, mais leur emplacement exact est approximatif et ne correspond à aucune vraie exploitation.

| Lieu | Rôle dans le jeu | Moments forts |
| --- | --- | --- |
| Maison familiale | Bureau : clients, prix public, marque, chef de culture, missions (un bâtiment du village, près de la Cour Saint-Vincent) | Toute l'année |
| Les Prières (0,7 ha, chardonnay) | Parcelle héritée | Taille à vendanges |
| Les Crémonts (0,8 ha, pinot noir) | Parcelle héritée | Taille à vendanges |
| Les Vorivals (0,5 ha, meunier) | Parcelle héritée | Taille à vendanges |
| Les Sellettes (1 ha, pinot noir) | Parcelle à louer en fermage | Dès l'an 1 |
| Les Côtes à Bras (0,6 ha, chardonnay) | Parcelle à acheter | Fin de partie |
| Pressoir | Pressurage, vente des raisins au négoce (un bâtiment agricole du village) | Septembre, octobre |
| Cave et cuverie | Vins clairs, assemblage, tirage, lattes, dégorgement (au pied de la forêt, près de l'abbaye) | Toute l'année |
| Maison Delaunay & Fils (château, fictif) | Grande maison de négoce : contrat raisins, rachat sur lattes | Toute l'année |
| Notaire et banque | Emprunts, fermage, achat de vignes, succession, bilan (près de la Place de la République) | Toute l'année |
| Église abbatiale Saint-Sindulphe | Histoire et culture : Dom Pérignon, saint Vincent, la craie | Janvier (fête de la Saint-Vincent) |
| Loge de vigne (fictive) | Petite cabane dans les vignes, point de vue et quiz | Toute l'année |

Autres lieux réels repérables : Place de la République, Cour Saint-Vincent, mairie, parc de l'abbaye, forêt domaniale de Hautvillers, la Marne et le canal latéral à la Marne.

**Deuxième carte prévue : Épernay et l'avenue de Champagne.** Le jeu lit n'importe quelle carte importée (`?carte=epernay`). Pour l'ajouter : renseigner `cartes/epernay.json`, lancer `npm run importer -- epernay`, puis placer les lieux (voir `cartes/README.md`).

**Style graphique** : réalisme stylisé et chaleureux : vrais volumes de la carte réelle, textures photo (crépi, tuiles, ardoise, pierre, herbe), ciel réaliste, lumière douce, ombres douces, brume légère au loin. Pas de réalisme photo intégral : il reste adapté au navigateur d'un téléphone (qualité adaptative, ombres et définition réduites sur écran tactile).

**Saisons visibles** : vigne nue et sol pâle en hiver, givre les matins de gel, jeunes feuilles vert clair en avril, haies vertes en été, grappes vertes puis noires ou dorées, cueilleurs dans les rangs en septembre, feuilles jaunes et rousses en octobre et novembre. Pluie, orage et grêle s'affichent quand ils arrivent.

**Vie du village** : quelques habitants qui marchent, un tracteur enjambeur dans les rangs, des oiseaux, les cloches à midi. Sons d'ambiance doux, qu'on coupe d'un bouton.

## Interface et contrôles mobile

Le monde 3D doit occuper au moins 75 % de l'écran, avec les deux pouces libres. Le prototype échouait là-dessus : interface trop envahissante, joystick mal placé, panneaux qui cachaient tout.

- **Orientation** : paysage en priorité, portrait supporté. Respect des zones sûres (encoche, barre de gestes).
- **Barre du haut** : une seule ligne fine, 40 px de haut maximum : date, jours de travail restants, trésorerie. Le reste (carte, missions, carnet, réglages) est dans un bouton menu.
- **Joystick dynamique** : il apparaît là où le pouce gauche touche, dans le quart bas gauche de l'écran. Diamètre 110 px, invisible au repos.
- **Caméra** : glisser dans la moitié droite pour tourner, pincer pour zoomer, double tap pour recentrer derrière le personnage.
- **Bouton d'action** : grand rond de 72 px en bas à droite, avec icône et nom court du lieu. Il n'apparaît que près d'un lieu.
- **Panneaux** : en paysage, panneau latéral droit de 40 % de la largeur ; en portrait, tiroir du bas de 60 % de la hauteur maximum. Le monde reste visible et le jeu se met en pause.
- **Mini-carte** : petite, en haut à droite ; un tap ouvre la carte plein écran avec déplacement rapide vers chaque lieu.
- **Notifications** : une seule à la fois, en bas, 3 secondes. Les nouvelles pages du carnet ne bloquent jamais le jeu : une icône clignote, on les lit quand on veut.
- **Lisibilité** : texte de 15 px minimum, boutons de 44 px minimum, contraste fort sur fond clair et foncé.
- **Vérification** : captures d'écran automatiques à 360×800, 390×844, 768×1024 et 1280×720, en paysage et en portrait, à chaque changement d'interface.

## Boucle de jeu et calendrier

Un tour de jeu = un mois. Le joueur a 10 jours de travail par mois (16 avec un chef de culture). Il se déplace vers les lieux, fait ses travaux, puis appuie sur « Fin du mois ». Les jours non utilisés sont perdus.

**Fin de mois, dans cet ordre** : pénalités des travaux oubliés, météo et maladies, vieillissement des bouteilles, ventes directes, charges, nouvelles offres de clients, puis un écran de résumé : ce qui s'est passé, comptes du mois, et ce qui arrive le mois suivant en Champagne. Le 31 décembre s'ajoutent les impôts, les droits de succession et le bilan annuel.

| Mois | Dans les vignes | En cave | Commerce | Risques |
| --- | --- | --- | --- | --- |
| Janvier | Taille | Assemblage, tirage | Calme | – |
| Février | Taille | Assemblage, tirage | Calme | – |
| Mars | Fin de taille, liage | Tirage | Inscription au concours | – |
| Avril | Liage, protection | Tirage | Mariages | Gel |
| Mai | Ébourgeonnage, protection | Tirage | Résultats du concours | Mildiou |
| Juin | Palissage, protection | Fin des tirages, reste en réserve | Mariages | Coulure, mildiou |
| Juillet | Palissage, rognage, protection | Dégorgement | Été, tourisme | Grêle, oïdium |
| Août | Protection, véraison | Dégorgement | Ban des vendanges, prix du raisin | Grêle, canicule |
| Septembre | Vendanges | Pressurage, débourbage | Vente des raisins | Raisins non cueillis perdus |
| Octobre | Labour | Fermentations, malolactique | Commandes de fin d'année | Raisins non pressés bradés |
| Novembre | Buttage | Dégorgement pour les fêtes | Comités d'entreprise | – |
| Décembre | Repos | Dégorgement | Pic des ventes (x 2,8) | Rupture de stock |

## Règles du métier

Chaque règle suit la réalité champenoise, simplifiée. Les chiffres ci-dessous sont les valeurs de départ, à ajuster par la simulation d'équilibrage.

### Vigne

Chaque travail se fait soi-même (en jours) ou par une équipe (en euros). Une parcelle a trois jauges : santé (0 à 100, cette saison), qualité des raisins (cette année) et qualité des souches (long terme, monte de 2 par an si la vigne est bien soignée, baisse de 2 sinon).

| Travail | Mois | Jours par ha | Équipe par ha | Si oublié |
| --- | --- | --- | --- | --- |
| Taille (choix du système) | Janv. à mars | 5 | 3 500 € | Récolte -30 %, qualité -5 |
| Liage | Mars, avril | 2 | 1 200 € | Santé -6 |
| Protection du vignoble | Chaque mois d'avril à août | 1 | 600 € | Risque de maladie 45 % au lieu de 5 % |
| Ébourgeonnage | Mai | 3 | 1 800 € | Qualité -4, santé -5 |
| Palissage | Juin, juillet | 3 | 1 800 € | Santé -8, qualité -2 |
| Rognage | Juillet | 1 | 700 € | Qualité -2 |
| Vendanges (cueilleurs) | Septembre | 1 | 0,90 € par kg, payé en fin de mois | Raisins perdus |
| Labour et buttage | Oct., nov. | 2 | 900 € | Santé -4 |

**Taille** : quatre systèmes autorisés. Le système idéal donne +3 de qualité : Chablis pour le chardonnay, Cordon de Royat pour le pinot noir, Vallée de la Marne pour le meunier. Vallée de la Marne est interdit sur les autres cépages. Guyot et Cordon sont acceptés partout.

**Récolte** = hectares × 11 500 kg × effets météo × (0,6 + 0,4 × santé / 100), plafonnée au rendement autorisé annoncé en août (10 000 à 12 000 kg/ha).

### Vendanges et pressoir

- Les raisins cueillis vont au pressoir le même mois. Le joueur choisit, cépage par cépage, ce qu'il presse pour lui ; le reste est vendu à la Maison Delaunay au prix du contrat ou au prix du marché (6,60 à 8,60 €/kg).
- Un marc de 4 000 kg donne 2 050 L de cuvée + 500 L de taille. Garder la taille : plus de volume, qualité -2. Cuvée seule : qualité +2.
- Sans pressoir : 0,35 €/kg à la coopérative. Au-delà de la cuverie : vinification à façon, 1 €/L.
- Raisins non pressés fin octobre : vendus 15 % sous le prix.

### Cave

- **Octobre à décembre** : choix de la malolactique (style rond ou vif).
- **Janvier à juin** : assemblage avec les vins clairs de l'année précédente et les vins de réserve, puis tirage (1,80 € par bouteille). Fin juin, les vins clairs restants partent en réserve.
- **Bonus d'assemblage** : trois cépages à 15 % ou plus, +4 ; 10 à 35 % de réserve, +3 ; plus de 50 % de réserve, -2.

| Cuvée | Règle | Vieillissement minimum | Prix |
| --- | --- | --- | --- |
| Brut sans année | Libre | 15 mois | x 1 |
| Blanc de blancs | 100 % chardonnay | 15 mois | x 1,10 |
| Rosé d'assemblage | Au moins 15 % de pinot noir (vin rouge) | 15 mois | x 1,15 |
| Millésimé | Une seule année jugée exceptionnelle, sans réserve | 36 mois | x 1,35 |

- **Dégorgement et dosage** : 1,10 € par bouteille. Remuage à la main : 1 jour pour 800 bouteilles ; avec gyropalettes : 0,15 € par bouteille et aucun jour. Chaque tranche de 6 mois au-delà du minimum donne +2 de qualité (maximum +8). *Équilibrage (étape 2) : le dégorgement est possible d'avril à décembre, pour que la cuvée du père (tirée en janvier de l'an 1) puisse être vendue vers le mois 16.*
- **Sept dosages** : brut nature, extra brut, brut, extra dry, sec, demi-sec, doux. Un brut nature de qualité sous 65 perd 4 points.

### Commerce

| Client | Réputation minimum | Prix par bouteille | Quantité | Exigence | Réputation |
| --- | --- | --- | --- | --- | --- |
| Caviste à Bruxelles | 0 | 19 € | 120 à 400 | Brut | +2 |
| Pâtissier de Reims | 8 | 21 € | 60 à 150 | Demi-sec | +1 |
| Organisatrice de mariages | 10 | 21 € | 150 à 400 | Brut, mars à août | +1 |
| Centrale d'achat de supermarchés | 8 | 13,50 € | 1 500 à 4 000 | Aucune | -4 |
| Comité d'entreprise | 15 | 19 € | 300 à 900 | Sept. à déc. | +1 |
| Réseau de cavistes en France | 22 | 18,50 € | 400 à 1 200 | Brut | +3 |
| Restaurant étoilé à Reims | 28 | 31 € | 60 à 180 | Extra brut, qualité 64+ | +4 |
| Importateur à Londres | 35 | 20 € | 600 à 1 500 | Brut | +3 |
| Importateur à Tokyo | 45 | 25 € | 300 à 900 | Extra brut, qualité 68+ | +4 |
| Palace parisien | 60 | 46 € | 60 à 200 | Qualité 78+ | +6 |

- Les offres n'arrivent qu'avec une marque déposée (statut RM), 0 à 2 par mois (au lieu de 1 à 3), valables 2 mois, une seule offre ouverte par client à la fois. Prix final = prix × (0,75 + qualité / 200) × bonus de cuvée.
- **Vente directe** : le joueur fixe son prix public (14 à 60 €). Demande du mois = base × saison × (26 / prix)^1,8 × (0,7 + qualité moyenne / 200). Base = 30 sans marque, sinon 30 + 6 × réputation (au lieu de 50 + 10 ×), +140 avec la boutique en ligne, +260 avec le caveau.
### Prix de revient et négociation des prix (ajout de l'étape 2)

Le joueur fixe **tous** ses prix. Le jeu lui montre ce que lui coûte une bouteille pour qu'il sache si c'est rentable.

- **Prix de revient direct** d'une bouteille : le raisin (travaux de la vigne : euros de l'équipe, ou jours faits soi-même valorisés au salaire ÷ jours = 200 € par jour, fermage, divisés par la récolte), plus le pressurage (0,35 €/kg à la coopérative), la vinification à façon, le tirage (1,80 €), le dégorgement (1,10 €) et le remuage (0,15 € ou un jour par 800 bouteilles). Il suit le vin de la presse à la bouteille, y compris dans les assemblages.
- **Frais fixes** de la maison (rémunération, frais généraux, chef de culture) : répartis sur toute la récolte, qu'elle soit transformée ou vendue, donc sur chaque kg de raisin puis chaque bouteille.
- **Coût complet** = coût direct + frais fixes : c'est le prix plancher en dessous duquel on perd de l'argent.
- **Gain par rapport à la vente du raisin** : prix de la bouteille − coût de transformation − ce que rapporterait le raisin vendu à la Maison Delaunay. C'est ce qui dit si transformer vaut la peine.
- **Prix conseillé** : celui qui rapporte le plus compte tenu de la demande (jamais sous le coût complet).
- **Vente directe** : le joueur règle son prix public (14 à 60 €) ; la demande baisse quand le prix monte (formule ci-dessus).
- **Offres des clients** : chaque client a un prix de référence pour la qualité de la bouteille (prix × (0,75 + qualité/200) × bonus de cuvée) et un prix maximum (la référence × (1,08 + 0,003 × réputation) : plus le joueur est connu, plus on le paie). Le joueur propose son prix : le client accepte à coup sûr jusqu'à 95 % de son prix maximum, tire au sort entre 95 et 120 %, refuse au-delà. Après un refus, il contre-propose ; après deux refus, il s'en va. Accepter le prix de référence réussit toujours.
- Le **bilan annuel** indique le prix de revient moyen et la marge moyenne par bouteille vendue.

- **Contrat raisins** : la Maison Delaunay propose un prix garanti jusqu'en juillet (7,00 à 7,90 €/kg). Elle rachète aussi les bouteilles sur lattes à 11 € × facteur qualité, sans réputation pour le joueur.
- **Concours** : inscription en mars ou avril (400 €). En mai : or si qualité 75+ (+8 de réputation), argent si 68+ (+4).

## Économie et équilibrage

Le jeu doit être serré les deux premières années, puis récompenser le joueur qui transforme ses raisins lui-même. L'équilibrage se règle par simulation automatique, pas à l'intuition.

### Départ

| Élément | Valeur |
| --- | --- |
| Date | Janvier 2027 |
| Trésorerie | 40 000 € |
| Vignes | 2 ha (0,7 chardonnay, 0,8 pinot noir, 0,5 meunier), santé 85, qualité environ 52 |
| Cave | 8 000 places, pas de cuverie, pas de pressoir |
| Stock | 600 bouteilles de brut faites à la coopérative (qualité 55) |
| Vins clairs 2026 du père | 1 200 L pinot noir, 800 L meunier, 1 000 L chardonnay |
| Droits de succession | 75 000 €, 25 000 € chaque 31 décembre pendant 3 ans |
| Réputation | 5 sur 100 |

### Charges et investissements

| Poste | Montant |
| --- | --- |
| Rémunération du joueur | 2 000 € par mois |
| Frais généraux (assurances, cotisations, comptable, matériel, carburant) — ajouté à l'étape 2 | 4 000 € par mois |
| Faillite | trésorerie sous −50 000 € à la fin d'un mois |
| Chef de culture (+6 jours par mois) | 3 200 € par mois |
| Fermage des Sellettes | 14 000 € par an |
| Emprunt | 4,5 % par an, 10 % du capital remboursé par an, plafond 120 000 € + 300 000 € par ha possédé |
| Impôts et cotisations | 25 % du résultat annuel positif, payés par acomptes trimestriels (mars, juin, septembre, décembre), l'excédent est remboursé en décembre |
| Marque (statut RM) | 9 000 € |
| Boutique en ligne | 6 000 € |
| Caveau de dégustation | 70 000 € |
| Protection antigel | 18 000 € |
| Pressoir pneumatique | 60 000 € |
| Cuverie +5 000 L | 20 000 € |
| Cave +10 000 bouteilles | 35 000 € |
| Gyropalettes | 25 000 € |
| Les Côtes à Bras (0,6 ha) | 680 000 € |

### Météo

| Événement | Mois | Probabilité | Effet |
| --- | --- | --- | --- |
| Gel de printemps | Avril | 20 % | Récolte -20 à -45 % (moitié avec antigel) |
| Coulure | Juin | 15 % | Récolte -8 à -18 % |
| Belle floraison | Juin | 30 % | Récolte +5 %, bonus millésime +3 |
| Mildiou ou oïdium | Mai à août | 5 % protégé, 45 % sinon | Santé -10 à -20, récolte -5 à -15 % |
| Grêle | Juillet, août | 10 % par mois | Une parcelle perd 15 à 40 % |
| Canicule | Août | 15 % | Récolte -5 % |
| Été idéal | Août | 25 % | Bonus millésime +4 |

Un millésime est déclaré si le bonus de l'année atteint 6 ou si la qualité moyenne des raisins atteint 72.

### Objectifs d'équilibrage

1. **Joueur passif** (vend tout au négoce, équipes partout) : survit, gagne 10 000 à 20 000 € par an, réputation sous 15.
2. **Joueur prudent** (garde 25 à 35 % des raisins, crée sa marque en an 1) : trésorerie jamais sous -20 000 €, dépasse le joueur passif dès l'an 4, réputation 40 en an 6.
3. **Joueur ambitieux** (garde 60 % et plus, investit beaucoup) : risque réel de faillite en an 2 ou 3, mais le meilleur résultat en an 10 s'il tient.
4. **Joueur négligent** (oublie la moitié des travaux) : vigne qui se dégrade, faillite probable avant l'an 5.
5. Première vente de bouteilles sous sa marque possible vers le mois 16 (cuvée du père tirée en janvier de l'an 1).
6. Une année entière ne peut pas être finie en moins de 30 minutes de jeu réel.

### Problèmes vus dans le prototype

- Trésorerie trop tendue en janvier de l'an 2 : impôts et succession tombent ensemble le 31 décembre. **Réglé à l'étape 2 : impôts payés par acomptes trimestriels.**
- La cave de 8 000 places bloque vite l'assemblage d'une deuxième cuvée. **Étape 2 : on garde 8 000 places, avec un message clair (« La cave manque de place ») et l'agrandissement à 35 000 € ; à vérifier sur téléphone.**
- Les équipes coûtent cher par rapport aux jours : le joueur ne sait pas quand déléguer. **Étape 2 : la simulation fournit le coût d'un jour (salaire ÷ jours = 200 €) et le coût de l'équipe par jour pour chaque travail (ex. taille : 700 €/jour) ; l'écran les affichera à l'étape 3.**
- Le passage du temps était trop rapide dans la version 2D : garder le rythme mois par mois.

## Contenu éducatif

Le joueur apprend en faisant : chaque action débloque une page du « Carnet du vigneron », chaque mois s'ouvre sur ce qui se passe réellement en Champagne, et 12 missions guident la progression. Tous les textes doivent être relus par Alexis avant publication.

### Carnet du vigneron

| Page | Ce que le joueur apprend | Débloquée par |
| --- | --- | --- |
| La taille | 4 systèmes autorisés ; la taille fixe rendement et concentration | Première taille |
| La bonne taille | Cordon de Royat pour le pinot noir, Chablis pour le chardonnay, Vallée de la Marne réservée au meunier | Taille idéale |
| Le liage, l'ébourgeonnage, le palissage, le rognage | À quoi sert chaque geste | Chaque travail |
| Mildiou et oïdium | Chaleur humide contre chaleur sèche | Première protection ou attaque |
| La vendange à la main | Obligatoire : grappes entières pour garder blanc le jus des raisins noirs | Première vendange |
| Le marc de 4 000 kg | 2 050 L de cuvée + 500 L de taille | Premier pressurage |
| Le débourbage | 12 à 24 h de repos du moût | Premier pressurage |
| La malolactique | Acide malique vif, acide lactique doux | Premier choix |
| L'assemblage et les vins de réserve | Cépages, villages, années ; constance du style | Premier assemblage |
| Le rosé d'assemblage | Blanc + rouge, permis en Champagne ; la saignée | Premier rosé |
| Blanc de blancs, blanc de noirs | Raisins blancs seuls, raisins noirs seuls | Premier blanc de blancs |
| Le millésime | Une seule année, 3 ans minimum | Premier millésime |
| Le tirage et la prise de mousse | Liqueur de tirage, seconde fermentation, environ 6 bars | Premier tirage |
| Le vieillissement sur lattes | 15 mois minimum dont 12 sur lies ; arômes de brioche | Premier tirage |
| Le remuage | Pupitres et gyropalettes | Premier dégorgement |
| Le dégorgement | Col dans la saumure glacée, dépôt expulsé | Premier dégorgement |
| Le dosage | Les 7 mentions et leurs grammes de sucre | Premier dégorgement |
| Les lettres de l'étiquette | RM, NM, CM, RC | Création de la marque |
| Vignerons et maisons | Les vignerons possèdent l'essentiel du vignoble, les maisons vendent la majorité des bouteilles | Visite du château |
| Dom Pérignon | Il n'a pas inventé le champagne ; assemblage et pressurage | Visite de l'abbatiale |
| Saint Vincent | Patron des vignerons, fêté vers le 22 janvier | Visite de l'abbatiale |
| La craie | Réserve d'eau pour la vigne ; les crayères servent de caves | Agrandissement de la cave |
| Grands et premiers crus | Surface de l'appellation, villages classés | Création de la marque |
| Gel, floraison, ban des vendanges | Risques et calendrier fixé par la filière | Événements météo |
| Prix du raisin, prix et demande, concours | Économie du métier | Contrat, prix public, concours |

### Missions

1. Tailler tes trois parcelles avant fin mars.
2. Visiter l'abbatiale d'Hautvillers.
3. Rencontrer la Maison Delaunay au château (maison fictive).
4. Assembler et tirer la cuvée de ton père.
5. Réussir ta première vendange.
6. Presser tes propres raisins.
7. Créer ta marque de champagne.
8. Dégorger et doser ta première cuvée.
9. Vendre 1 000 bouteilles sous ta marque.
10. Atteindre 40 de réputation.
11. Mettre un millésime en cave.
12. Décrocher une médaille d'or.

Chaque mission rapporte 2 points de réputation et une page de carnet.

### Autres formes d'apprentissage

- **Texte du mois** : 2 ou 3 phrases sur ce qui se passe en Champagne ce mois-là, affichées au résumé de fin de mois.
- **Quiz de la loge de vigne** : 3 questions tirées des pages déjà débloquées ; une bonne série donne +1 de réputation.
- **Dégustation à l'assemblage** : chaque vin clair a une petite description (fruité, vif, rond, minéral) qui aide à composer la cuvée.

## Feuille de route

Le jeu se construit en 9 étapes, chacune envoyée par un prompt et validée sur le téléphone avant de passer à la suivante.

0. **Mise en place** : validée quand la page d'accueil s'ouvre sur le téléphone.
1. **Monde et contrôles** : validée quand on se promène au village sans gêne, en paysage et en portrait.
2. **Simulation et équilibrage** : validée quand les 4 profils de joueurs atteignent leurs objectifs.
3. **Vignes et saisons** : validée quand une année de vigne complète se joue, saisons visibles.
4. **Pressoir et cave** : validée quand on va de la grappe à la bouteille dosée.
5. **Commerce, banque, château** : validée quand 10 ans se jouent de bout en bout, faillite comprise.
6. **Contenu éducatif** : validée quand Alexis a relu et corrigé tous les textes.
7. **Graphismes et son** : validée quand les vrais modèles 3D tournent à 30 images par seconde sur téléphone.
8. **Mode Défi du bar** : validée quand une partie de 10 minutes a été testée lors d'un événement.

L'étape 2 est le cœur du projet : tant que la simulation n'est pas équilibrée, les graphismes ne servent à rien.

## Points à vérifier avant de vendre le jeu

- **Le mot « Champagne » dans le nom d'un produit** : l'appellation est très protégée par le Comité Champagne. Demander un avis juridique, ou prévoir un nom sans le mot.
- **Thème de l'alcool** : vérifier l'âge minimum conseillé (classification PEGI) et les règles de publicité pour l'alcool si le jeu est vendu en France (loi Évin).
- **Exactitude des faits** : relecture complète du carnet par Alexis. Chiffres à vérifier en priorité : 34 000 ha, 17 grands crus et 42 premiers crus, part du vignoble détenue par les vignerons, règles de taille par cépage.
- **Licences des modèles 3D et des sons** : chaque fichier listé dans `docs/CREDITS.md` avec sa licence.
