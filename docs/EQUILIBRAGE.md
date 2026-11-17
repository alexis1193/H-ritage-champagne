# Équilibrage de la simulation (étape 2)

Tout se rejoue avec `npm run simuler` (500 parties × 10 ans × 4 profils en ~2 s) et se garde avec `npm test`
(`tests/sim/equilibrage.test.ts` échoue si un objectif du GDD n'est plus tenu).
Les chiffres sont dans `src/data/*.json` (`parametres.json`, `travaux.json`, `clients.json`, `cuvees.json`, `dosages.json`).

## Résultats (500 parties, valeurs actuelles)
| Profil | Faillites | Patrimoine an 4 | an 6 | an 10 | Réputation an 6 | Trésorerie minimale (10 % pires) |
|---|---|---|---|---|---|---|
| Passif | 0 % | 47 000 € | 79 000 € | 148 000 € | 5 | −400 € |
| Prudent | 0 % | 183 000 € | 279 000 € | 487 000 € | 43 | −1 750 € |
| Ambitieux | 20 % en an 3, 38 % au total | 49 000 € | 153 000 € | 630 000 € (survivants) | 38 | −56 000 € |
| Négligent | 78 % en an 3, 95 % en an 4 | – | – | – | 5 | −56 000 € |

Gain du passif : environ 15 000 € de patrimoine par an à partir de l'an 4 (résultat avant impôts ≈ 21 000 €).

## Ce qui a été changé par rapport au GDD, et pourquoi
| Chiffre | GDD | Maintenant | Pourquoi |
|---|---|---|---|
| Frais généraux | (absent) | 4 000 €/mois | Avec les seules charges du GDD, le passif gagnait ≈ 70 000 €/an au lieu de 10 000 à 20 000 €. Ce poste (assurances, cotisations, comptable, entretien du matériel) ramène son gain à ≈ 15 000 €/an. |
| Seuil de faillite | (absent) | trésorerie < −50 000 € | Il fallait une règle de fin de partie ; elle laisse un découvert supportable. |
| Impôts | 25 % le 31 décembre | 25 %, par acomptes trimestriels, excédent remboursé | Piste du GDD : éviter que impôts et succession tombent ensemble. |
| Offres des clients | 1 à 3 par mois | 0 à 2 par mois, une seule offre ouverte par client | Un même client pouvait envoyer plusieurs offres : le joueur écoulait 4 000 bouteilles en quelques mois. |
| Demande en vente directe (avec marque) | 50 + 10 × réputation | 30 + 6 × réputation | La cuvée du père rapportait 70 000 € en an 2, ce qui rendait les deux premières années trop faciles. |
| Mois de dégorgement | juillet-août, novembre-décembre | avril à décembre | Objectif 5 : une cuvée tirée en janvier de l'an 1 a 15 mois en avril de l'an 2 (mois 16). |
| Cave | 8 000 places | 8 000 places (inchangé) | L'ambitieux la remplit et doit l'agrandir (35 000 €) : c'est voulu. Le message de refus est explicite. |

Inchangés : prix des investissements, charges de personnel, fermage, emprunt, météo, coûts des travaux, prix du raisin, clients.

## Prix de revient (ajouté à la demande d'Alexis)
Ordres de grandeur d'une partie « prudente » (2 ha, équipe + jours, sans cuverie ni pressoir) :
- coût direct d'une bouteille : **≈ 5,8 €** (raisin ≈ 3 €, pressurage et façon ≈ 1,5 €, tirage 1,80 €, dégorgement 1,10 €, remuage) ;
- frais fixes par bouteille : **≈ 4,9 €** (72 000 € par an répartis sur 21 t de raisin) ;
- coût complet : **≈ 10,7 €** ; raisin vendu au négoce : **≈ 11,5 € l'équivalent d'une bouteille** ;
- prix conseillé : **≈ 23 €** ; prix public de départ : 26 €.
Conséquence : à 20 € la bouteille rapporte ≈ 9 € de marge sur le coût complet, mais seulement ≈ 5 € de plus que de vendre le raisin (20 − 3 − 11,5 − ...). Transformer reste rentable, sans être un cadeau : c'est le sens de l'objectif « serré puis récompensé ».
L'équilibrage des 4 profils n'a pas changé (les bots refusent seulement les offres sous le coût, il n'y en avait pas).

## Points d'attention (à discuter)
- **L'objectif 6 (une année ne se finit pas en moins de 30 minutes)** est une règle de rythme de l'interface (étape 3), pas de la simulation. La simulation compte 40 à 60 décisions par an pour un joueur actif ; le reste du temps vient du résumé mensuel, des déplacements et de la lecture. À garantir à l'étape 3 (résumé de fin de mois toujours affiché, pas de saut automatique).
- **Le prudent dépasse le passif dès l'an 1 en patrimoine**, pas seulement dès l'an 4 : la cuvée du père (3 000 L) et la marque rapportent tôt. Sa trésorerie, elle, reste plus basse que celle du passif en an 1 (47 000 € contre 92 000 €). L'objectif « dès l'an 4 » est respecté, mais les deux premières années sont plus faciles qu'annoncé si le joueur crée sa marque tout de suite.
- **Le négligent fait faillite à 100 % sur 10 ans** (78 % dès l'an 3). Le GDD dit « probable avant l'an 5 » : c'est atteint, mais la chute est rapide car les travaux oubliés pèsent d'un coup (récolte −30 %, vendanges perdues) plus que par dégradation lente des souches.
- **L'ambitieux** dépend beaucoup de la façon dont il emprunte (le simulateur le fait emprunter à −40 000 €). Un vrai joueur prudent avec la banque ferait mieux : le risque de 20-38 % est celui d'un joueur qui attend trop pour emprunter.
- **Les profils sont des bots simples.** Un humain trouvera sans doute des stratégies meilleures (blanc de blancs, rosé, millésimés, prix dynamiques) ; elles ne sont pas toutes jouées par les bots. À réévaluer après des parties réelles.
- **Qualité des raisins** : `qualité = souches + 3 (taille idéale) + ajustements − pénalité de santé`. Le GDD ne donnait pas cette formule ; la pénalité de santé (0,15 point par point sous 70) est de moi.
- **Malolactique** : « rond » donne +1 de qualité, « vif » 0 (le GDD ne chiffre pas ces deux styles).
- **Vin rouge** : le pinot noir et le meunier peuvent être vinifiés en rouge (0,6 L/kg) pour faire un rosé d'assemblage (≥ 15 % de rouge).
- **Rachat sur lattes de la Maison Delaunay** : 11 € × (0,75 + qualité/200), comme les offres.
