import { depenser, encaisser, erreur, exploitees, hectaresPossedes, noter, ok, parcelle, totalBouteilles, anneeCourante } from './partie';
import type { Bilan, Partie, Resultat } from './types';

/** Banque, investissements, charges, impôts, succession, bilan. */

export const plafondEmprunt = (p: Partie): number => p.params.charges.plafondBaseEmprunt + p.params.charges.plafondParHa * hectaresPossedes(p);

export function emprunter(p: Partie, montant: number): Resultat {
  if (montant <= 0) return erreur('Montant invalide.');
  if (p.emprunt + montant > plafondEmprunt(p) + 1e-6) return erreur(`Plafond d'emprunt : ${Math.round(plafondEmprunt(p))} €.`);
  p.emprunt += montant; p.empruntBase += montant;
  encaisser(p, montant, 'emprunt');
  p.resultatAn -= montant; // le capital emprunté n'est pas un revenu imposable
  p.actions++;
  return ok();
}

export type Investissement = 'marque' | 'boutique' | 'caveau' | 'antigel' | 'pressoir' | 'cuverie' | 'cave' | 'gyropalettes';

export function investir(p: Partie, quoi: Investissement): Resultat {
  const prix = p.params.investissements[quoi];
  const deja = { marque: p.marque, boutique: p.boutique, caveau: p.caveau, antigel: p.antigel, pressoir: p.pressoir, cuverie: false, cave: false, gyropalettes: p.gyropalettes }[quoi];
  if (deja) return erreur('Déjà fait.');
  if ((quoi === 'boutique' || quoi === 'caveau') && !p.marque) return erreur("Il faut d'abord déposer votre marque.");
  if (p.tresorerie - prix < p.params.charges.seuilFaillite) return erreur("La banque refuse : la trésorerie deviendrait trop négative. Empruntez d'abord.");
  depenser(p, prix, `investissement ${quoi}`, false);
  p.capex += prix;
  if (quoi === 'marque') p.marque = true;
  if (quoi === 'boutique') p.boutique = true;
  if (quoi === 'caveau') p.caveau = true;
  if (quoi === 'antigel') p.antigel = true;
  if (quoi === 'pressoir') p.pressoir = true;
  if (quoi === 'gyropalettes') p.gyropalettes = true;
  if (quoi === 'cuverie') p.cuverieLitres += p.params.capacites.cuverieIncrement;
  if (quoi === 'cave') p.cavePlaces += p.params.capacites.caveIncrement;
  p.actions++;
  return ok();
}

export function louerParcelle(p: Partie, id: string): Resultat {
  const x = parcelle(p, id);
  if (!x || x.statut !== 'disponible_fermage') return erreur('Cette parcelle n\'est pas à louer.');
  x.statut = 'louee'; p.actions++;
  return ok();
}

export function acheterParcelle(p: Partie, id: string): Resultat {
  const x = parcelle(p, id);
  const prix = p.params.investissements.achatParcelle;
  if (!x || x.statut !== 'disponible_achat') return erreur('Cette parcelle n\'est pas à vendre.');
  if (p.tresorerie - prix < p.params.charges.seuilFaillite) return erreur("Il faut d'abord emprunter pour acheter.");
  depenser(p, prix, 'achat de vigne', false);
  p.terres += prix; x.statut = 'possedee'; p.actions++;
  return ok();
}

export function embaucherChef(p: Partie): Resultat {
  if (p.chefCulture) return erreur('Déjà embauché.');
  p.chefCulture = true; p.jours += p.params.temps.joursAvecChef - p.params.temps.joursParMois; p.actions++;
  return ok();
}
export function licencierChef(p: Partie): Resultat {
  if (!p.chefCulture) return erreur("Pas de chef de culture.");
  p.chefCulture = false; p.jours = Math.min(p.jours, p.params.temps.joursParMois); p.actions++;
  return ok();
}

/** Fin de mois, étape 5 : rémunération, chef de culture, fermage, intérêts, découvert, vendanges payées. */
export function payerCharges(p: Partie): void {
  const c = p.params.charges;
  depenser(p, c.salaireMois, 'rémunération');
  depenser(p, c.fraisGenerauxMois, 'frais généraux');
  if (p.chefCulture) depenser(p, c.chefCultureMois, 'chef de culture');
  const louees = p.parcelles.filter((x) => x.statut === 'louee').length;
  if (louees) depenser(p, (c.fermageAn / 12) * louees, 'fermage');
  if (p.emprunt > 0) depenser(p, (p.emprunt * c.interetsEmprunt) / 12, 'intérêts');
  if (p.tresorerie < 0) depenser(p, (-p.tresorerie * c.decouvertTaux) / 12, 'agios');
  if (p.cueilletteAPayer > 0) { depenser(p, p.cueilletteAPayer, 'cueilleurs'); p.cueilletteAPayer = 0; }
}

/** Impôts payés par trimestre (mars, juin, septembre, décembre) : 25 % du résultat positif de l'année, par acomptes. */
export function acompteImpots(p: Partie): number {
  const du = Math.max(0, p.params.charges.tauxImpots * p.resultatAn) - p.impotsPayesAn;
  if (du <= 0) return 0;
  depenser(p, du, 'impôts et cotisations', false);
  p.impotsPayesAn += du;
  return du;
}

/** Valeur approximative de la maison de champagne (pour comparer les parties). */
export function patrimoine(p: Partie): number {
  const c = p.params.commerce;
  const val = 0.6; // valeur prudente du stock : 60 % du prix de rachat de la Maison Delaunay
  const bouteilles = val * (p.stock.reduce((s, l) => s + l.n * c.rachatLattes * (0.75 + l.qualite / 200), 0) + p.lattes.reduce((s, l) => s + l.n * c.rachatLattes * (0.75 + l.qualite / 200), 0));
  const vins = p.lots.reduce((s, l) => s + l.litres * 3, 0);
  return Math.round(p.tresorerie - p.emprunt - p.successionRestante + bouteilles + vins + 0.5 * p.capex + p.terres);
}

/** 31 décembre : impôts, droits de succession, remboursement de l'emprunt, bilan annuel. */
export function finDAnnee(p: Partie): Bilan {
  const c = p.params.charges;
  acompteImpots(p);
  // Les acomptes sont calculés sur le résultat du moment : si l'année finit moins bien, l'excédent est remboursé.
  const du = Math.max(0, c.tauxImpots * p.resultatAn);
  if (p.impotsPayesAn > du) { const rembourse = p.impotsPayesAn - du; p.tresorerie += rembourse; p.compteAn.depenses['impôts et cotisations'] = (p.compteAn.depenses['impôts et cotisations'] ?? 0) - rembourse; p.impotsPayesAn = du; }
  if (p.successionRestante > 0) {
    const part = Math.min(p.successionAnnuite, p.successionRestante);
    depenser(p, part, 'droits de succession', false);
    p.successionRestante -= part;
  }
  if (p.emprunt > 0) {
    const part = Math.min(p.emprunt, c.remboursementAn * p.empruntBase);
    depenser(p, part, 'remboursement du capital', false);
    p.emprunt -= part;
    if (p.emprunt < 1) { p.emprunt = 0; p.empruntBase = 0; }
  }
  const ca = Object.entries(p.compteAn.recettes).filter(([k]) => k !== 'emprunt').reduce((s, [, v]) => s + v, 0);
  const sorties = Object.entries(p.compteAn.depenses).reduce((s, [, v]) => s + v, 0);
  const bilan: Bilan = {
    annee: anneeCourante(p), ca: Math.round(ca), charges: Math.round(sorties), resultat: Math.round(p.resultatAn), impots: Math.round(p.impotsPayesAn),
    tresorerie: Math.round(p.tresorerie), reputation: p.reputation, emprunt: Math.round(p.emprunt), patrimoine: patrimoine(p),
    bouteillesVendues: p.bouteillesVendues, faillite: p.faillite,
  };
  p.bilans.push(bilan);
  p.compteAn = { recettes: {}, depenses: {} }; p.resultatAn = 0; p.impotsPayesAn = 0; p.bouteillesVendues = 0;
  noter(p, `Bilan ${bilan.annee} : résultat ${bilan.resultat} €, trésorerie ${bilan.tresorerie} €.`);
  return bilan;
}

export const exploitationTotale = (p: Partie): number => exploitees(p).reduce((s, x) => s + x.ha, 0);
export const stockEnCave = totalBouteilles;
