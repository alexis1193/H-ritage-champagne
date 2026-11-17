import {
  accepterOffre, evaluerOffre, analyseRentabilite, apercuAssemblage, choisirMalo, degorger, demandeDirecte, embaucherChef, emprunter, faireTravail, finDuMois, fixerPrixPublic,
  inscrireConcours, investir, louerParcelle, moisCourant, anneeCourante, placesLibres, presserRaisins, qualiteMoyenneStock, signerContrat,
  systemeIdeal, tirer, travauxDus, vendreRaisins, anJeu, CLIENTS, stockTotal, offreRealisable, prixOffre, client,
} from './index';
import { suivant } from './rng';
import type { Dosage, Partie, PartLot } from './index';

/**
 * Joueurs automatiques : ils jouent par les mêmes actions que le vrai joueur. Servent à équilibrer le jeu sans écran.
 * Chaque profil est une fonction appelée au début de chaque mois ; le simulateur appelle ensuite « fin du mois ».
 */
export type Profil = 'passif' | 'prudent' | 'ambitieux' | 'negligent';
export interface Reglage { partGardee: number; investit: 'aucun' | 'prudent' | 'ambitieux'; oubli: number; oubliVendanges: number; marque: boolean; louer: boolean }

const REGLAGES: Record<Profil, Reglage> = {
  passif: { partGardee: 0, investit: 'aucun', oubli: 0, oubliVendanges: 0, marque: false, louer: false },
  negligent: { partGardee: 0, investit: 'aucun', oubli: 0.5, oubliVendanges: 0.2, marque: false, louer: false },
  prudent: { partGardee: 0.3, investit: 'prudent', oubli: 0, oubliVendanges: 0, marque: true, louer: false },
  ambitieux: { partGardee: 0.7, investit: 'ambitieux', oubli: 0, oubliVendanges: 0, marque: true, louer: true },
};

/** Travaux du mois : par l'équipe (passif, négligent) ou en utilisant d'abord les jours là où l'équipe coûte le plus cher. */
function travaux(p: Partie, mode: 'equipe' | 'optimal', oubli: number, oubliVendanges = oubli): void {
  const dus = travauxDus(p).sort((a, b) => b.coutEquipe / Math.max(0.01, b.jours) - a.coutEquipe / Math.max(0.01, a.jours));
  for (const d of dus) {
    if (suivant(p) < (d.travail.id === 'vendanges' ? oubliVendanges : oubli)) continue;
    const parc = p.parcelles.find((x) => x.id === d.parcelleId);
    if (!parc) continue;
    const opts = { systeme: systemeIdeal(parc.cepage) };
    if (mode === 'optimal' && d.jours <= p.jours + 1e-9) { if (faireTravail(p, d.parcelleId, d.travail.id, 'soi', opts).ok) continue; }
    if (p.tresorerie > p.params.charges.seuilFaillite * 0.6 || d.travail.id === 'vendanges') faireTravail(p, d.parcelleId, d.travail.id, 'equipe', opts);
  }
}

function vendreTout(p: Partie): void { for (const r of [...p.raisins]) vendreRaisins(p, r.cepage, r.kg); }

/** Garde une part du raisin pour le presser (cuvée seule, qualité +2) et vend le reste au négoce. */
function presserEtVendre(p: Partie, part: number): void {
  for (const r of [...p.raisins]) {
    const kg = Math.floor((r.kg * part) / 100) * 100;
    if (kg > 0) presserRaisins(p, r.cepage, kg, { garderTaille: false });
    const reste = p.raisins.find((x) => x.cepage === r.cepage);
    if (reste) vendreRaisins(p, r.cepage, reste.kg);
  }
}

function maloDesLots(p: Partie): void { for (const l of p.lots) if (!l.style && l.annee === anneeCourante(p)) choisirMalo(p, l.id, 'rond'); }

/** Assemblage de janvier à juin : vins clairs de l'an dernier + un peu de réserve (10 à 35 % → +3), jusqu'aux places de la cave. */
function assemblerEtTirer(p: Partie, marge: number): void {
  const an = anneeCourante(p);
  const neufs = p.lots.filter((l) => !l.reserve && l.annee === an - 1);
  if (!neufs.length) return;
  const millesime = p.millesimes.includes(an - 1) && neufs.every((l) => l.qualite >= 0) && p.lots.filter((l) => l.annee === an - 1 && !l.reserve).length > 0;
  const total = neufs.reduce((s, l) => s + l.litres, 0);
  const reserve = p.lots.filter((l) => l.reserve);
  const resTotal = reserve.reduce((s, l) => s + l.litres, 0);
  const resVoulu = Math.min(resTotal, total / 3);
  const parts: PartLot[] = neufs.map((l) => ({ lotId: l.id, litres: l.litres }));
  let r = resVoulu;
  for (const l of reserve) { if (r <= 0) break; const v = Math.min(l.litres, r); parts.push({ lotId: l.id, litres: v }); r -= v; }
  const libres = placesLibres(p) - marge;
  if (libres < 200) return;
  const a0 = apercuAssemblage(p, parts, 'brut_sans_annee');
  const echelle = a0.bouteilles > libres ? libres / a0.bouteilles : 1;
  const ajuste = parts.map((x) => ({ lotId: x.lotId, litres: Math.floor(x.litres * echelle) })).filter((x) => x.litres > 0);
  if (millesime) {
    const seuls = neufs.map((l) => ({ lotId: l.id, litres: Math.floor(l.litres * Math.min(1, libres / (a0.bouteilles || 1))) })).filter((x) => x.litres > 0);
    if (tirer(p, seuls, 'millesime').ok) return;
  }
  tirer(p, ajuste, 'brut_sans_annee');
}

/** Dégorge ce qui est mûr, en dosant « brut » (le plus demandé) et « extra brut » pour les clients exigeants. */
function degorgerMur(p: Partie, max: number): void {
  let reste = max;
  for (const l of [...p.lattes]) {
    const min = l.cuvee === 'millesime' ? 36 : 15;
    if (l.age < min || reste <= 0) continue;
    const n = Math.min(l.n, reste);
    const dosage: Dosage = p.reputation >= 25 && l.qualite >= 62 && suivant(p) < 0.35 ? 'extra brut' : 'brut';
    if (degorger(p, l.id, n, dosage).ok) reste -= n;
  }
}

/** Accepte les offres rentables, de la plus lucrative à la moins lucrative (la centrale d'achat dégrade la réputation : seulement en cas de besoin). */
function offres(p: Partie, accepteCentrale: boolean): void {
  const triees = [...p.offres].sort((a, b) => (client(b.clientId)?.prix ?? 0) - (client(a.clientId)?.prix ?? 0));
  for (const o of triees) {
    const cl = client(o.clientId);
    if (!cl || (cl.id === 'centrale' && !accepteCentrale)) continue;
    if (!offreRealisable(p, o.id).ok) continue;
    const ev = evaluerOffre(p, o.id);
    if (ev.ok && ev.prixReference < ev.coutRevient * 1.05) continue; // à ce prix on perd de l'argent : on refuse
    accepterOffre(p, o.id);
  }
}

/** Prix public : assez bas pour écouler le stock en 6 mois environ, entre 20 et 45 €. */
function fixerPrix(p: Partie): void {
  const stock = stockTotal(p);
  if (!stock) return;
  const cible = stock / 6;
  let prix = 20;
  for (let x = 45; x >= 20; x -= 1) { prix = x; if (demandeDirecte(p, x) >= cible) break; }
  const plancher = Math.ceil(analyseRentabilite(p).coutDirectMoyen * 1.1);
  fixerPrixPublic(p, Math.min(60, Math.max(prix, plancher)));
}

function plan(p: Partie, r: Reglage): void {
  const m = moisCourant(p); const an = anJeu(p);
  if (r.investit === 'ambitieux') {
    if (an === 1 && m === 0) { emprunter(p, 80000); investir(p, 'marque'); investir(p, 'pressoir'); investir(p, 'cuverie'); louerParcelle(p, 'parcelle4'); }
    if (an === 1 && m === 1) investir(p, 'boutique');
    if (an === 1 && m === 2 && AMBITIEUX.antigelAn1) investir(p, 'antigel');
    if (an === 2 && m === 0) { investir(p, 'cuverie'); investir(p, 'gyropalettes'); }
    if (an === 2 && m === 0 && AMBITIEUX.lourdAn2) investir(p, 'caveau');
    if (an === 2 && m === 3 && !AMBITIEUX.lourdAn2) investir(p, 'caveau');
    if (p.tresorerie < AMBITIEUX.seuilEmprunt && p.emprunt < AMBITIEUX.plafondEmprunt) emprunter(p, 40000); // l'ambitieux comble les trous par l'emprunt : le risque vient de la dette
    if (an >= 2 && !p.chefCulture && p.tresorerie > 10000) embaucherChef(p);
    if (an >= 3 && p.tresorerie > 120000) investir(p, 'antigel');
    if (an >= 3 && p.tresorerie > 150000) investir(p, 'caveau');
    if (an >= 2 && m <= 5 && placesLibres(p) < 2500 && p.tresorerie > 20000 && p.cavePlaces < 40000) investir(p, 'cave'); // la cave se remplit : on l'agrandit
  } else if (r.investit === 'prudent') {
    if (an === 1 && m === 0) investir(p, 'marque');
    if (an === 2 && m === 0 && p.tresorerie > 25000) investir(p, 'boutique');
    if (an >= 3 && p.tresorerie > 70000) investir(p, 'antigel');
    if (an >= 3 && p.tresorerie > 90000) investir(p, 'cuverie');
    if (an >= 4 && p.tresorerie > 120000) investir(p, 'cave');
    if (an >= 4 && p.tresorerie > 140000) investir(p, 'gyropalettes');
    if (p.tresorerie < 2000 && p.emprunt < 40000) emprunter(p, 20000);
  }
}

/** Joue un mois pour un profil. */
export function jouerMois(p: Partie, profil: Profil): void {
  const r = REGLAGES[profil];
  const m = moisCourant(p);
  if (m === 0 || m === 1 || m === 2) { /* contrat avant juillet */ }
  if (m === 0 && p.contratPrix === null) signerContrat(p);

  if (r.investit === 'aucun') { // passif et négligent : équipes partout, tout le raisin au négoce
    if (profil === 'passif' && p.tresorerie < 8000 && p.emprunt < 150000) emprunter(p, 30000); // précaution : on emprunte plutôt que de plonger
    travaux(p, 'equipe', r.oubli, r.oubliVendanges);
    if (m === 8) vendreTout(p);
    return;
  }
  plan(p, r);
  travaux(p, 'optimal', 0);
  if (m === 8 || m === 9) presserEtVendre(p, r.partGardee);
  if (m >= 9) maloDesLots(p);
  if (m <= 5) assemblerEtTirer(p, r.investit === 'ambitieux' ? 500 : 1000);
  if (m === 2 && p.reputation >= 5 && Math.max(0, ...p.stock.map((s) => s.qualite)) >= 66) inscrireConcours(p);
  if (p.params.cave.moisDegorgement.includes(m)) degorgerMur(p, Math.floor((p.jours - 1) * p.params.cave.bouteillesParJourRemuage) || (p.gyropalettes ? 99999 : 0));
  offres(p, p.tresorerie < 0);
  fixerPrix(p);
}

/** Réglages de comportement de l'ambitieux (explorés par le simulateur). */
export const AMBITIEUX = { antigelAn1: false, lourdAn2: true, seuilEmprunt: -40000, plafondEmprunt: 250000 };

export const PROFILS: Profil[] = ['passif', 'prudent', 'ambitieux', 'negligent'];
export { finDuMois, CLIENTS, prixOffre, qualiteMoyenneStock };
