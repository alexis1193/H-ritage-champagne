import { acompteImpots, finDAnnee, payerCharges } from './finance';
import { anneeCourante, exploitees, joursMax, moisCourant, noter } from './partie';
import { entre } from './rng';
import { genererOffres, resultatConcours, ventesDirectes } from './commerce';
import { proposerContrat } from './partie';
import { appliquerMeteo, appliquerOublis, majSouches, nouvelleSaison, qualiteRaisins } from './vigne';
import { versLaReserve, vendreRaisins, vieillir } from './vin';
import type { Partie, Resume } from './types';

/**
 * Fin de mois, dans cet ordre : pénalités des travaux oubliés, météo et maladies, vieillissement des bouteilles,
 * ventes directes, charges, nouvelles offres. Le 31 décembre s'ajoutent impôts, droits de succession et bilan annuel.
 */
export function finDuMois(p: Partie): Resume {
  const m = moisCourant(p);
  const annee = anneeCourante(p);
  const avant = p.tresorerie;
  const ev: string[] = [];
  let bilan = null;
  if (p.faillite) return { mois: m, annee, evenements: ['La maison est en faillite.'], tresorerieAvant: avant, tresorerieApres: avant, comptes: p.compteMois, bilan: null };

  appliquerOublis(p, ev); // 1
  appliquerMeteo(p, ev); // 2

  if (m === 4) { const r = resultatConcours(p); if (r) ev.push(`Concours : médaille d'${r === 'or' ? 'or' : 'argent'} !`); }
  if (m === 6) { // annonce d'août : rendement autorisé et prix du marché
    const r = p.params.rendement; const g = p.params.raisins;
    p.plafondHa = Math.round(entre(p, r.plafondMin, r.plafondMax) / 100) * 100;
    p.prixMarche = Math.round(entre(p, g.prixMarcheMin, g.prixMarcheMax) * 20) / 20;
    ev.push(`Ban des vendanges : rendement autorisé ${p.plafondHa} kg/ha, raisin à ${p.prixMarche.toFixed(2)} €/kg.`);
    if (p.contratPrix === null) ev.push("L'offre de contrat de la Maison Delaunay s'est terminée en juillet.");
  }
  if (m === 8) { // millésime : bonus de l'année ≥ 6 ou qualité moyenne des raisins ≥ 72
    const rec = exploitees(p).filter((x) => (x.recolteKg ?? 0) > 0);
    const kg = rec.reduce((s, x) => s + (x.recolteKg ?? 0), 0);
    const q = kg ? rec.reduce((s, x) => s + qualiteRaisins(p, x) * (x.recolteKg ?? 0), 0) / kg : 0;
    if (p.bonusMillesime >= p.params.meteo.millesime.bonus || q >= p.params.meteo.millesime.qualite) { p.millesimes.push(annee); ev.push(`${annee} est déclarée année exceptionnelle (millésime possible).`); }
  }
  if (m === 9) { // raisins non pressés : vendus 15 % sous le prix
    for (const r of [...p.raisins]) { vendreRaisins(p, r.cepage, r.kg, p.params.pressoir.brade); ev.push(`Raisins non pressés vendus ${Math.round(p.params.pressoir.brade * 100)} % sous le prix.`); }
  }
  if (m === 11) for (const l of p.lots) if (l.annee === annee && !l.style) l.style = 'vif';

  vieillir(p); // 3
  const v = ventesDirectes(p); // 4
  if (v.n) ev.push(`Ventes directes : ${v.n} bouteilles, ${Math.round(v.ca)} €.`);
  payerCharges(p); // 5
  if (m === 2 || m === 5 || m === 8) acompteImpots(p);
  if (m === 5) { const n = versLaReserve(p); if (n) ev.push(`${Math.round(n)} L de vins clairs partent en réserve.`); }
  genererOffres(p); // 6
  if (p.tresorerie < p.params.charges.seuilFaillite) { p.faillite = true; ev.push('Trésorerie épuisée : faillite.'); noter(p, 'Faillite.'); }
  if (m === 11) { majSouches(p); bilan = finDAnnee(p); }

  const comptes = p.compteMois;
  const apres = p.tresorerie;
  // passage au mois suivant
  p.moisAbs++;
  p.jours = joursMax(p);
  p.compteMois = { recettes: {}, depenses: {} };
  for (const x of p.parcelles) x.faits.protection = false;
  const nm = moisCourant(p);
  if (nm === 0) { nouvelleSaison(p); proposerContrat(p); }
  if (nm === 8) p.litresCampagne = 0;
  return { mois: m, annee, evenements: ev, tresorerieAvant: avant, tresorerieApres: apres, comptes, bilan };
}
