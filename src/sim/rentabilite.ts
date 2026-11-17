import { demandeDirecte, stockTotal } from './commerce';
import { prixRaisinsKg } from './vin';
import type { Partie } from './types';

/**
 * Prix de revient : combien coûte vraiment une bouteille, et à quel prix est-elle rentable ?
 * - coût direct : ce que la production a coûté (travaux de la vigne, jours valorisés, pressurage, tirage, dégorgement, remuage) ;
 * - frais fixes : la part des charges de la maison (rémunération, frais généraux, chef de culture) par bouteille produite ;
 * - coût complet = coût direct + frais fixes. Sous ce prix, on perd de l'argent ;
 * - raisin au négoce : ce que rapporterait le raisin d'une bouteille s'il était vendu à la Maison Delaunay au lieu d'être transformé.
 */
export interface LigneCout {
  source: 'stock' | 'lattes'; id: number; n: number; qualite: number; cuvee: string;
  coutDirect: number; coutMatiere: number; coutComplet: number;
}
export interface Rentabilite {
  lignes: LigneCout[];
  bouteilles: number;
  /** ce que la bouteille a réellement coûté à produire (vigne, jours valorisés, pressurage, tirage, dégorgement, remuage) */
  coutDirectMoyen: number;
  /** part des frais fixes de la maison portée par une bouteille (répartis sur toute la récolte, qu'elle soit transformée ou vendue) */
  fraisFixesParBouteille: number;
  coutCompletMoyen: number;
  /** ce que rapporterait le raisin d'une bouteille vendu à la Maison Delaunay */ raisinAuNegoce: number;
  /** coût de transformation seul (tout sauf le raisin) */ coutTransformation: number;
  /** prix en dessous duquel on perd de l'argent (coût complet) */ prixPlancher: number;
  /** prix qui rapporte le plus compte tenu de la demande */ prixConseille: number;
  margeAuPrixPublic: number; tauxMarge: number;
  /** ce que gagne le joueur par bouteille en transformant plutôt qu'en vendant le raisin, au prix public actuel */ gainSurVenteRaisin: number;
  rentable: boolean;
}

/** Frais fixes annuels de la maison (hors travaux de la vigne) : rémunération, frais généraux, chef de culture. */
export function fraisFixesAn(p: Partie): number {
  const c = p.params.charges;
  return 12 * (c.salaireMois + c.fraisGenerauxMois + (p.chefCulture ? c.chefCultureMois : 0));
}

/** Récolte d'une année normale (santé 85) sur les parcelles exploitées, en kg. */
export function recolteTypique(p: Partie): number {
  const r = p.params.rendement;
  return p.parcelles.filter((x) => x.statut === 'possedee' || x.statut === 'louee').reduce((s, x) => s + x.ha * r.baseKgHa * (r.santeMini + r.santePart * 0.85), 0);
}

export const kgRaisinParBouteille = (p: Partie): number =>
  p.params.cave.litresParBouteille / (p.params.pressoir.litresCuveeParMarc / p.params.pressoir.kgParMarc);

/** Frais fixes par bouteille : les frais fixes servent toute l'exploitation, ils sont donc répartis sur tous les kg récoltés. */
export function fraisFixesParBouteille(p: Partie): number {
  return (fraisFixesAn(p) / Math.max(1, recolteTypique(p))) * kgRaisinParBouteille(p);
}

/** Prix de vente (14 à 60 €) qui rapporte le plus au joueur compte tenu de la demande ; au minimum le coût complet. */
export function prixConseille(p: Partie, coutComplet: number): number {
  const c = p.params.commerce;
  const dispo = Math.max(1, stockTotal(p) + p.lattes.reduce((s, l) => s + l.n, 0)); // bouteilles à vendre, prêtes ou sur lattes
  let meilleur = Math.min(c.prixPublicMax, Math.max(c.prixPublicMin, Math.ceil(coutComplet * 1.05)));
  let gain = -1e12;
  for (let prix = c.prixPublicMin; prix <= c.prixPublicMax; prix += 0.5) {
    const g = (prix - coutComplet) * Math.min(dispo, demandeDirecte(p, prix, 5));
    if (g > gain) { gain = g; meilleur = prix; }
  }
  return meilleur;
}

export function analyseRentabilite(p: Partie): Rentabilite {
  const fixes = fraisFixesParBouteille(p);
  const deg = p.params.cave.coutDegorgement;
  const lignes: LigneCout[] = [
    ...p.stock.map((s) => ({ source: 'stock' as const, id: s.id, n: s.n, qualite: s.qualite, cuvee: s.cuvee, coutDirect: s.cout, coutMatiere: s.coutMatiere, coutComplet: s.cout + fixes })),
    ...p.lattes.map((l) => ({ source: 'lattes' as const, id: l.id, n: l.n, qualite: l.qualite, cuvee: l.cuvee, coutDirect: l.cout + deg, coutMatiere: l.coutMatiere, coutComplet: l.cout + deg + fixes })),
  ];
  const n = lignes.reduce((s, x) => s + x.n, 0);
  const moy = (f: (x: LigneCout) => number): number => (n ? lignes.reduce((s, x) => s + x.n * f(x), 0) / n : 0);
  const direct = moy((x) => x.coutDirect);
  const complet = direct + fixes;
  const transformation = direct - moy((x) => x.coutMatiere);
  const negoce = kgRaisinParBouteille(p) * prixRaisinsKg(p);
  const prixStock = stockTotal(p) ? p.prixPublic : 0;
  return {
    lignes, bouteilles: n, coutDirectMoyen: direct, fraisFixesParBouteille: fixes, coutCompletMoyen: complet, raisinAuNegoce: negoce,
    coutTransformation: transformation, prixPlancher: complet, prixConseille: prixConseille(p, complet),
    margeAuPrixPublic: prixStock ? prixStock - complet : 0, tauxMarge: prixStock ? (prixStock - complet) / prixStock : 0,
    gainSurVenteRaisin: prixStock ? prixStock - transformation - negoce : 0, rentable: prixStock > complet,
  };
}
