import { creerPartie, finDuMois } from './index';
import { jouerMois, PROFILS, type Profil } from './profils';
import { copierParams } from './params';
import type { Params, Partie } from './types';

/** Joue des parties entières sans écran et résume les résultats. */
export interface Serie { tresorerie: number; patrimoine: number; reputation: number; resultat: number }
export interface Partie10 {
  profil: Profil; graine: number; faillite: number | null; // mois de faillite (1 = premier mois) ou null
  annees: Serie[]; minTresorerie: number; premiereVenteMois: number | null; actions: number; moisJoues: number;
}

export function jouerPartie(profil: Profil, graine: number, params: Params, annees = 10): Partie10 {
  const p: Partie = creerPartie(params, graine);
  let min = p.tresorerie; let faillite: number | null = null;
  const series: Serie[] = [];
  let dernierResultat = 0;
  for (let mois = 1; mois <= annees * 12; mois++) {
    if (!p.faillite) jouerMois(p, profil);
    const r = finDuMois(p);
    min = Math.min(min, p.tresorerie);
    if (p.faillite && faillite === null) faillite = mois;
    if (r.bilan) { dernierResultat = r.bilan.resultat; series.push({ tresorerie: r.bilan.tresorerie, patrimoine: r.bilan.patrimoine, reputation: r.bilan.reputation, resultat: dernierResultat }); }
  }
  return { profil, graine, faillite, annees: series, minTresorerie: Math.round(min), premiereVenteMois: p.premiereVenteMois === null ? null : p.premiereVenteMois + 1, actions: p.actions, moisJoues: annees * 12 };
}

const moyenne = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const centile = (a: number[], q: number): number => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export interface Synthese {
  profil: Profil; parties: number; tauxFaillite: number; faillitesAn: number[]; // part de parties en faillite avant la fin de l'an k (k = 1..10)
  tresorerieAn: number[]; patrimoineAn: number[]; reputationAn: number[]; resultatAn: number[]; // moyennes sur les parties survivantes
  minTresorerieMoy: number; minTresorerieP10: number; premiereVente: number; actionsParAn: number; minutesParAn: number;
}

export function resumer(profil: Profil, jeux: Partie10[], annees = 10): Synthese {
  const survivants = (k: number) => jeux.filter((j) => j.annees[k]).filter((j) => j.faillite === null || j.faillite > (k + 1) * 12);
  const par = (f: (s: Serie) => number) => Array.from({ length: annees }, (_, k) => moyenne(survivants(k).map((j) => f(j.annees[k]))));
  const ventes = jeux.map((j) => j.premiereVenteMois).filter((x): x is number => x !== null);
  const actions = moyenne(jeux.map((j) => j.actions / (j.moisJoues / 12)));
  return {
    profil, parties: jeux.length, tauxFaillite: jeux.filter((j) => j.faillite !== null).length / jeux.length,
    faillitesAn: Array.from({ length: annees }, (_, k) => jeux.filter((j) => j.faillite !== null && j.faillite <= (k + 1) * 12).length / jeux.length),
    tresorerieAn: par((s) => s.tresorerie), patrimoineAn: par((s) => s.patrimoine), reputationAn: par((s) => s.reputation), resultatAn: par((s) => s.resultat),
    minTresorerieMoy: moyenne(jeux.map((j) => j.minTresorerie)), minTresorerieP10: centile(jeux.map((j) => j.minTresorerie), 0.1),
    premiereVente: moyenne(ventes), actionsParAn: actions,
    // estimation du temps réel : ~10 s par action + ~2 min 30 par mois (lecture du résumé, déplacements, panneaux)
    minutesParAn: (actions * 10 + 12 * 150) / 60,
  };
}

export function simuler(parties: number, params: Params = copierParams(), annees = 10, profils: Profil[] = PROFILS, graineDepart = 1000): Synthese[] {
  return profils.map((pr) => resumer(pr, Array.from({ length: parties }, (_, i) => jouerPartie(pr, graineDepart + i, params, annees)), annees));
}
