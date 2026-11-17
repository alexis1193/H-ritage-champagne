import { CLIENTS, CUVEES, PARAMS, TRAVAUX } from './params';
import type { CuveeId, Lot, Params, Partie, ParcelleEtat, Resultat } from './types';

export const anneeCourante = (p: Partie): number => p.params.depart.annee + Math.floor(p.moisAbs / 12);
export const moisCourant = (p: Partie): number => p.moisAbs % 12;
export const anJeu = (p: Partie): number => Math.floor(p.moisAbs / 12) + 1;
export const ok = (): Resultat => ({ ok: true });
export const erreur = (e: string): Resultat => ({ ok: false, erreur: e });
export const client = (id: string) => CLIENTS.find((c) => c.id === id);
export const cuvee = (id: CuveeId) => CUVEES.find((c) => c.id === id);
export const travail = (id: string) => TRAVAUX.find((t) => t.id === id);
export const nouvelId = (p: Partie): number => p.prochainId++;
export const parcelle = (p: Partie, id: string): ParcelleEtat | undefined => p.parcelles.find((x) => x.id === id);

/** Parcelles que le joueur exploite (possédées ou louées). */
export const exploitees = (p: Partie): ParcelleEtat[] => p.parcelles.filter((x) => x.statut === 'possedee' || x.statut === 'louee');
export const hectaresPossedes = (p: Partie): number => p.parcelles.filter((x) => x.statut === 'possedee').reduce((s, x) => s + x.ha, 0);
export const joursMax = (p: Partie): number => (p.chefCulture ? p.params.temps.joursAvecChef : p.params.temps.joursParMois);

/** Nouvelle partie : janvier 2027, 40 000 €, 2 ha hérités, 600 bouteilles et les vins clairs du père. */
export function creerPartie(params: Params = PARAMS, graine = 1): Partie {
  const d = params.depart;
  const p: Partie = {
    params, rng: graine, moisAbs: 0, jours: params.temps.joursParMois, tresorerie: d.tresorerie, reputation: d.reputation,
    marque: false, boutique: false, caveau: false, antigel: false, pressoir: false, gyropalettes: false, chefCulture: false,
    cuverieLitres: d.cuverieLitres, cavePlaces: d.cavePlaces,
    parcelles: params.parcelles.map((x) => ({
      id: x.id, nom: x.nom, cepage: x.cepage, ha: x.ha, statut: x.statut, sante: d.santeVigne, qualiteSouches: d.qualiteSouches, qualiteAjust: 0,
      bonusTaille: 0, systeme: null, faits: {}, oublisAn: 0, facteurRecolte: 1, recolteKg: null, vendangee: false,
    })),
    raisins: [], lots: [], lattes: [], stock: [], offres: [], prixPublic: d.prixPublic, emprunt: 0, empruntBase: 0,
    successionRestante: d.successionAnnuite * d.successionAnnees, successionAnnuite: d.successionAnnuite,
    compteMois: { recettes: {}, depenses: {} }, compteAn: { recettes: {}, depenses: {} },
    resultatAn: 0, impotsPayesAn: 0, bouteillesVendues: 0, bouteillesVenduesTotal: 0, premiereVenteMois: null,
    plafondHa: params.rendement.plafondMax, prixMarche: (params.raisins.prixMarcheMin + params.raisins.prixMarcheMax) / 2,
    prixContratPropose: (params.raisins.prixContratMin + params.raisins.prixContratMax) / 2, contratPrix: null,
    bonusMillesime: 0, millesimes: [], litresCampagne: 0, concoursInscrit: false,
    bilans: [], faillite: false, prochainId: 1, coutVigneAn: 0, bouteillesTireesAn: 0, bouteillesTireesPrec: 0, coutVentesAn: 0, caBouteillesAn: 0, cueilletteAPayer: 0, capex: 0, terres: 0, actions: 0, journal: [],
  };
  for (const v of d.vinsClairs) p.lots.push({ id: nouvelId(p), cepage: v.cepage, litres: v.litres, qualite: d.qualiteVinsClairs, annee: d.annee - 1, rouge: v.cepage === 'pinot noir', style: 'vif', reserve: false, cout: d.coutLitreVinsClairs, coutMatiere: d.coutMatiereLitreVinsClairs });
  p.stock.push({ id: nouvelId(p), n: d.stockBouteilles.n, qualite: d.stockBouteilles.qualite, cuvee: 'brut_sans_annee', dosage: d.stockBouteilles.dosage, moisMise: -1, cout: d.stockBouteilles.cout, coutMatiere: d.stockBouteilles.coutMatiere });
  // Premier mois : le contrat de la Maison Delaunay est proposé en janvier (prix tiré au hasard).
  proposerContrat(p);
  return p;
}

import { entre } from './rng';
export function proposerContrat(p: Partie): void {
  const r = p.params.raisins;
  p.prixContratPropose = Math.round(entre(p, r.prixContratMin, r.prixContratMax) * 20) / 20;
  p.contratPrix = null;
}

// ---- comptabilité : tout l'argent passe par ces deux fonctions
export function encaisser(p: Partie, montant: number, categorie: string): void {
  p.tresorerie += montant;
  p.compteMois.recettes[categorie] = (p.compteMois.recettes[categorie] ?? 0) + montant;
  p.compteAn.recettes[categorie] = (p.compteAn.recettes[categorie] ?? 0) + montant;
  p.resultatAn += montant;
}
/** `deductible` : compte dans le résultat annuel imposable (les investissements, la succession et le capital emprunté n'y comptent pas). */
export function depenser(p: Partie, montant: number, categorie: string, deductible = true): void {
  p.tresorerie -= montant;
  p.compteMois.depenses[categorie] = (p.compteMois.depenses[categorie] ?? 0) + montant;
  p.compteAn.depenses[categorie] = (p.compteAn.depenses[categorie] ?? 0) + montant;
  if (deductible) p.resultatAn -= montant;
}
export const noter = (p: Partie, texte: string): void => { if (p.journal.length < 400) p.journal.push(texte); };
export const totalBouteilles = (p: Partie): number => p.lattes.reduce((s, l) => s + l.n, 0) + p.stock.reduce((s, l) => s + l.n, 0);
export const placesLibres = (p: Partie): number => p.cavePlaces - totalBouteilles(p);
export const lotParId = (p: Partie, id: number): Lot | undefined => p.lots.find((l) => l.id === id);

export const ajouterReputation = (p: Partie, v: number): void => { p.reputation = Math.max(0, Math.min(100, p.reputation + v)); };

/** Valeur d'un jour de travail du joueur : son salaire divisé par ses jours de travail (sert à chiffrer les travaux faits soi-même). */
export const valeurJour = (p: Partie): number => p.params.charges.salaireMois / p.params.temps.joursParMois;
