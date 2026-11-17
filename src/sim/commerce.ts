import { CLIENTS, CUVEES } from './params';
import { ajouterReputation, client, depenser, encaisser, erreur, moisCourant, nouvelId, noter, ok } from './partie';
import { entier, suivant } from './rng';
import type { Dosage, Partie, Resultat, StockPret } from './types';

/** Clients, offres, vente directe, contrat de raisins, rachat sur lattes, concours. */

export const stockTotal = (p: Partie): number => p.stock.reduce((s, l) => s + l.n, 0);
export function qualiteMoyenneStock(p: Partie): number {
  const n = stockTotal(p);
  return n ? p.stock.reduce((s, l) => s + l.n * l.qualite, 0) / n : 0;
}
const multCuvee = (s: StockPret): number => CUVEES.find((c) => c.id === s.cuvee)?.prix ?? 1;

/** Retire n bouteilles du stock (les plus anciennes d'abord) parmi celles qui passent le filtre. */
function retirer(p: Partie, n: number, filtre: (s: StockPret) => boolean): { qualite: number; mult: number; vendusPropres: number } | null {
  const dispo = p.stock.filter(filtre).reduce((s, l) => s + l.n, 0);
  if (dispo < n) return null;
  let reste = n; let q = 0; let m = 0; let propres = 0;
  for (const l of [...p.stock].filter(filtre).sort((a, b) => a.moisMise - b.moisMise)) {
    if (reste <= 0) break;
    const prend = Math.min(reste, l.n);
    l.n -= prend; reste -= prend; q += prend * l.qualite; m += prend * multCuvee(l);
    if (l.moisMise >= 0) propres += prend;
  }
  p.stock = p.stock.filter((l) => l.n > 0);
  return { qualite: q / n, mult: m / n, vendusPropres: propres };
}

function noterVente(p: Partie, n: number, propres: number): void {
  p.bouteillesVendues += n; p.bouteillesVenduesTotal += n;
  if (propres > 0 && p.marque && p.premiereVenteMois === null) p.premiereVenteMois = p.moisAbs;
}

export function fixerPrixPublic(p: Partie, prix: number): Resultat {
  const c = p.params.commerce;
  if (prix < c.prixPublicMin || prix > c.prixPublicMax) return erreur(`Le prix public va de ${c.prixPublicMin} à ${c.prixPublicMax} €.`);
  p.prixPublic = prix;
  return ok();
}

/** Demande du mois = base × saison × (26 / prix)^1,8 × (0,7 + qualité moyenne / 200). */
export function demandeDirecte(p: Partie, prix = p.prixPublic, mois = moisCourant(p)): number {
  const c = p.params.commerce;
  const q = qualiteMoyenneStock(p);
  let base = p.marque ? c.baseAvecMarque + c.baseParReputation * p.reputation : c.baseSansMarque;
  if (p.boutique) base += c.bonusBoutique;
  if (p.caveau) base += c.bonusCaveau;
  return Math.floor(base * c.saison[mois] * Math.pow(c.prixReference / prix, c.exposantPrix) * (0.7 + q / 200));
}

/** Fin de mois, étape 4 : ventes directes (boutique, caveau, particuliers). */
export function ventesDirectes(p: Partie): { n: number; ca: number } {
  const dispo = stockTotal(p);
  const n = Math.min(dispo, demandeDirecte(p));
  if (n <= 0) return { n: 0, ca: 0 };
  const r = retirer(p, n, () => true);
  if (!r) return { n: 0, ca: 0 };
  const ca = n * p.prixPublic;
  encaisser(p, ca, 'ventes directes');
  noterVente(p, n, r.vendusPropres);
  return { n, ca };
}

/** Fin de mois, étape 6 : 1 à 3 nouvelles offres, valables 2 mois, seulement avec une marque déposée. */
export function genererOffres(p: Partie): number {
  const c = p.params.commerce;
  p.offres = p.offres.filter((o) => o.expire >= p.moisAbs + 1);
  if (!p.marque) return 0;
  const n = entier(p, c.offresMin, c.offresMax);
  // un client n'a qu'une offre ouverte à la fois
  const eligibles = CLIENTS.filter((x) => x.reputationMin <= p.reputation && !p.offres.some((o) => o.clientId === x.id));
  for (let i = 0; i < n && eligibles.length; i++) {
    const cl = eligibles.splice(Math.floor(suivant(p) * eligibles.length), 1)[0];
    const qte = Math.round((cl.qteMin + (cl.qteMax - cl.qteMin) * suivant(p)) / 10) * 10;
    p.offres.push({ id: nouvelId(p), clientId: cl.id, qte, expire: p.moisAbs + c.offreDureeMois });
  }
  return n;
}

/** Prix final d'une offre = prix × (0,75 + qualité / 200) × bonus de cuvée. */
export const prixOffre = (prix: number, qualite: number, mult: number): number => prix * (0.75 + qualite / 200) * mult;

/** Peut-on honorer cette offre avec le stock actuel ? */
export function offreRealisable(p: Partie, offreId: number): Resultat {
  const o = p.offres.find((x) => x.id === offreId);
  const cl = o && client(o.clientId);
  if (!o || !cl) return erreur('Offre introuvable ou expirée.');
  if (cl.mois && !cl.mois.includes(moisCourant(p))) return erreur('Ce client ne reçoit pas de livraison ce mois-ci.');
  const eligibles = p.stock.filter((s) => (!cl.dosages || cl.dosages.includes(s.dosage)) && (!cl.qualiteMin || s.qualite >= cl.qualiteMin));
  if (eligibles.reduce((s, l) => s + l.n, 0) < o.qte) return erreur(`Il manque des bouteilles adaptées (${cl.dosages ? cl.dosages.join(' / ') : 'tous dosages'}${cl.qualiteMin ? `, qualité ${cl.qualiteMin}+` : ''}).`);
  return ok();
}

export function accepterOffre(p: Partie, offreId: number): Resultat {
  const verif = offreRealisable(p, offreId);
  if (!verif.ok) return verif;
  const o = p.offres.find((x) => x.id === offreId);
  const cl = o && client(o.clientId);
  if (!o || !cl) return erreur('Offre introuvable.');
  const r = retirer(p, o.qte, (s) => (!cl.dosages || cl.dosages.includes(s.dosage)) && (!cl.qualiteMin || s.qualite >= cl.qualiteMin));
  if (!r) return erreur('Stock insuffisant.');
  encaisser(p, o.qte * prixOffre(cl.prix, r.qualite, r.mult), 'offres');
  ajouterReputation(p, cl.reputation);
  noterVente(p, o.qte, r.vendusPropres);
  p.offres = p.offres.filter((x) => x !== o);
  noter(p, `Offre acceptée : ${cl.nom}, ${o.qte} bouteilles.`);
  p.actions++;
  return ok();
}

/** Contrat de raisins : la Maison Delaunay garantit un prix jusqu'en juillet. */
export function signerContrat(p: Partie): Resultat {
  if (p.contratPrix !== null) return erreur('Contrat déjà signé.');
  if (moisCourant(p) > 6) return erreur("L'offre de contrat est close (jusqu'en juillet).");
  p.contratPrix = p.prixContratPropose;
  p.actions++;
  return ok();
}

/** La Maison Delaunay rachète des bouteilles sur lattes à 11 € × facteur qualité, sans exiger de réputation. */
export function vendreSurLattes(p: Partie, lattesId: number, n: number): Resultat {
  const l = p.lattes.find((x) => x.id === lattesId);
  if (!l || n <= 0 || n > l.n) return erreur('Lot ou quantité invalide.');
  encaisser(p, n * p.params.commerce.rachatLattes * (0.75 + l.qualite / 200), 'rachat sur lattes');
  l.n -= n;
  if (l.n === 0) p.lattes = p.lattes.filter((x) => x !== l);
  p.actions++;
  return ok();
}

export function inscrireConcours(p: Partie): Resultat {
  const m = moisCourant(p);
  if (m !== 2 && m !== 3) return erreur("L'inscription au concours se fait en mars ou avril.");
  if (p.concoursInscrit) return erreur('Déjà inscrit.');
  depenser(p, p.params.charges.concours, 'concours');
  p.concoursInscrit = true;
  p.actions++;
  return ok();
}

/** En mai : or si qualité 75+ (+8 de réputation), argent si 68+ (+4). On présente la meilleure bouteille prête. */
export function resultatConcours(p: Partie): 'or' | 'argent' | null {
  if (!p.concoursInscrit) return null;
  const q = Math.max(0, ...p.stock.map((s) => s.qualite));
  const c = p.params.commerce;
  if (q >= c.concoursOr) { ajouterReputation(p, c.concoursReputationOr); return 'or'; }
  if (q >= c.concoursArgent) { ajouterReputation(p, c.concoursReputationArgent); return 'argent'; }
  return null;
}

export type { Dosage };
