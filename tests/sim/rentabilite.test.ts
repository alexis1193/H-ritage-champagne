import { describe, it, expect } from 'vitest';
import { neuve, allerAu, sansMeteo } from './aide';
import { faireTravail, coutRaisinKg } from '../../src/sim/vigne';
import { presserRaisins, tirer, degorger } from '../../src/sim/vin';
import { analyseRentabilite, fraisFixesAn, fraisFixesParBouteille, prixConseille, recolteTypique, kgRaisinParBouteille } from '../../src/sim/rentabilite';
import { evaluerOffre, proposerPrix, probabiliteAcceptation, accepterOffre, ventesDirectes } from '../../src/sim/commerce';
import { finDuMois } from '../../src/sim/mois';
import { valeurJour } from '../../src/sim/partie';
import { finDAnnee } from '../../src/sim/finance';
import type { Partie } from '../../src/sim/types';

/** Une année complète faite par l'équipe, jusqu'au pressurage de septembre. */
function jusquaPressurage(): Partie {
  const p = neuve(sansMeteo);
  const faire = (): void => {
    for (let mois = 0; mois <= 8; mois++) {
      for (const x of p.parcelles.filter((q) => q.statut === 'possedee')) {
        for (const t of ['taille', 'liage', 'protection', 'ebourgeonnage', 'palissage', 'rognage', 'vendanges']) faireTravail(p, x.id, t, 'equipe', { systeme: 'guyot' });
      }
      if (mois < 8) finDuMois(p);
    }
  };
  faire();
  return p;
}

describe('prix de revient de la production', () => {
  it('un jour fait soi-même vaut salaire ÷ jours (200 €) ; un travail d\'équipe coûte son prix', () => {
    const p = neuve(); expect(valeurJour(p)).toBe(200);
    faireTravail(p, 'parcelle2', 'taille', 'soi', { systeme: 'cordon' }); expect(p.coutVigneAn).toBeCloseTo(4 * 200); // 0,8 ha × 5 j
    faireTravail(p, 'parcelle1', 'taille', 'equipe', { systeme: 'chablis' }); expect(p.coutVigneAn).toBeCloseTo(800 + 3500 * 0.7);
  });
  it('prix de revient du raisin = coût de la vigne ÷ récolte', () => {
    const p = jusquaPressurage();
    const kg = p.parcelles.filter((x) => x.statut === 'possedee').reduce((s, x) => s + (x.recolteKg ?? 0), 0);
    expect(kg).toBeGreaterThan(15000);
    expect(coutRaisinKg(p)).toBeCloseTo(p.coutVigneAn / kg, 5);
    expect(coutRaisinKg(p)).toBeGreaterThan(0.5); expect(coutRaisinKg(p)).toBeLessThan(3);
  });
  it('le vin clair garde le prix de revient du raisin + pressurage à la coopérative + vinification à façon', () => {
    const p = jusquaPressurage(); const ck = coutRaisinKg(p);
    presserRaisins(p, 'chardonnay', 4000, { garderTaille: false });
    const l = p.lots.find((x) => x.annee === 2027)!;
    expect(l.litres).toBe(2050);
    // 4 000 kg × coût du raisin + 0,35 €/kg (coopérative) + 2 050 L à façon (1 €/L : pas de cuverie)
    expect(l.cout * l.litres).toBeCloseTo(4000 * ck + 4000 * 0.35 + 2050, 3);
    expect(l.coutMatiere * l.litres).toBeCloseTo(4000 * ck, 3);
  });
  it('tirage : prix de revient de la bouteille = vin × 0,75 L + 1,80 € ; dégorgement : + 1,10 € + remuage', () => {
    const p = neuve(); // vins clairs du père à 4,50 €/L
    tirer(p, p.lots.map((l) => ({ lotId: l.id, litres: l.litres })), 'brut_sans_annee');
    expect(p.lattes[0].cout).toBeCloseTo(4.5 * 0.75 + 1.8);
    expect(p.lattes[0].coutMatiere).toBeCloseTo(3.2 * 0.75);
    allerAu(p, 6); p.lattes[0].age = 20; p.jours = 10;
    degorger(p, p.lattes[0].id, 800, 'brut'); // remuage à la main : 1 jour = 200 € pour 800 bouteilles
    expect(p.stock.at(-1)!.cout).toBeCloseTo(4.5 * 0.75 + 1.8 + 1.1 + 200 / 800);
    const q = neuve(); tirer(q, q.lots.map((l) => ({ lotId: l.id, litres: l.litres })), 'brut_sans_annee'); allerAu(q, 6); q.lattes[0].age = 20; q.gyropalettes = true;
    degorger(q, q.lattes[0].id, 800, 'brut'); expect(q.stock.at(-1)!.cout).toBeCloseTo(4.5 * 0.75 + 1.8 + 1.1 + 0.15);
  });
  it('un assemblage mélange les prix de revient au prorata des litres', () => {
    const p = neuve(); p.lots[0].cout = 10; p.lots[1].cout = 4; p.lots[2].cout = 4; // 1 200 L à 10 €, 800 L et 1 000 L à 4 €
    tirer(p, p.lots.map((l) => ({ lotId: l.id, litres: l.litres })), 'brut_sans_annee');
    const moy = (1200 * 10 + 800 * 4 + 1000 * 4) / 3000;
    expect(p.lattes[0].cout).toBeCloseTo(moy * 0.75 + 1.8);
  });
});

describe('rentabilité : coût complet, prix plancher, prix conseillé', () => {
  it('les frais fixes (rémunération + frais généraux) sont répartis sur toute la récolte, pas seulement sur les bouteilles', () => {
    const p = neuve();
    expect(fraisFixesAn(p)).toBe(12 * (2000 + 4000));
    expect(fraisFixesParBouteille(p)).toBeCloseTo((72000 / recolteTypique(p)) * kgRaisinParBouteille(p));
    expect(kgRaisinParBouteille(p)).toBeCloseTo(0.75 / (2050 / 4000));
    p.chefCulture = true; expect(fraisFixesAn(p)).toBe(12 * (2000 + 4000 + 3200));
  });
  it('analyse : coût direct, coût complet, raisin au négoce, marge au prix public', () => {
    const p = neuve(); p.prixPublic = 26; p.prixMarche = 7;
    const a = analyseRentabilite(p);
    expect(a.bouteilles).toBe(600); expect(a.coutDirectMoyen).toBeCloseTo(9);
    expect(a.coutCompletMoyen).toBeCloseTo(9 + a.fraisFixesParBouteille);
    expect(a.raisinAuNegoce).toBeCloseTo(kgRaisinParBouteille(p) * 7);
    expect(a.margeAuPrixPublic).toBeCloseTo(26 - a.coutCompletMoyen);
    expect(a.rentable).toBe(true);
    p.prixPublic = a.coutCompletMoyen - 1; expect(analyseRentabilite(p).rentable).toBe(false);
  });
  it('gain par rapport à la vente du raisin = prix − coût de transformation − raisin au négoce', () => {
    const p = neuve(); p.prixPublic = 30; p.prixMarche = 7;
    const a = analyseRentabilite(p);
    expect(a.coutTransformation).toBeCloseTo(9 - 6);
    expect(a.gainSurVenteRaisin).toBeCloseTo(30 - 3 - a.raisinAuNegoce);
  });
  it('prix conseillé : jamais sous le coût complet, entre 14 et 60 €, et plus haut quand la production coûte plus cher', () => {
    const p = neuve();
    const bas = prixConseille(p, 8); const haut = prixConseille(p, 20);
    expect(bas).toBeGreaterThanOrEqual(14); expect(haut).toBeLessThanOrEqual(60); expect(haut).toBeGreaterThan(bas); expect(bas).toBeGreaterThanOrEqual(8);
  });
  it('le bilan annuel donne le prix de revient moyen et la marge moyenne par bouteille vendue', () => {
    const p = neuve(sansMeteo); allerAu(p, 5); p.stock[0].n = 1000; p.prixPublic = 20;
    p.bouteillesVendues = 0; p.caBouteillesAn = 0; p.coutVentesAn = 0; // on repart de zéro (les mois passés ont déjà vendu un peu)
    for (let i = 0; i < 6; i++) ventesDirectes(p);
    const vendues = p.bouteillesVendues; expect(vendues).toBeGreaterThan(0);
    const b = finDAnnee(p);
    expect(b.coutRevientMoyen).toBeCloseTo(9); expect(b.margeMoyenne).toBeCloseTo(11);
  });
});

describe('négociation du prix avec les clients', () => {
  const avecOffre = (client = 'caviste_bruxelles', qte = 100) => {
    const p = neuve(sansMeteo); p.marque = true;
    p.stock = [{ id: 1, n: 3000, qualite: 60, cuvee: 'brut_sans_annee', dosage: 'brut', moisMise: 0, cout: 8, coutMatiere: 5 }];
    p.offres.push({ id: 1, clientId: client, qte, expire: 9, essais: 0 });
    return p;
  };
  it('le client donne son prix de référence (qualité, cuvée), son prix maximum (réputation) et le prix de revient du joueur', () => {
    const p = avecOffre(); const e = evaluerOffre(p, 1);
    expect(e.ok).toBe(true); expect(e.prixReference).toBeCloseTo(19 * 1.05);
    expect(e.prixMax).toBeCloseTo(19 * 1.05 * (1.08 + 0.003 * p.reputation));
    expect(e.coutRevient).toBe(8); expect(e.margeReference).toBeCloseTo(19 * 1.05 - 8);
    p.reputation = 50; expect(evaluerOffre(p, 1).prixMax).toBeGreaterThan(e.prixMax); // le joueur évolue : on lui paie plus cher
  });
  it('probabilité : certaine jusqu\'à 95 % du prix maximum, nulle à 120 %, linéaire entre les deux', () => {
    const p = neuve();
    expect(probabiliteAcceptation(p, 95, 100)).toBe(1); expect(probabiliteAcceptation(p, 50, 100)).toBe(1);
    expect(probabiliteAcceptation(p, 120, 100)).toBe(0); expect(probabiliteAcceptation(p, 150, 100)).toBe(0);
    expect(probabiliteAcceptation(p, 107.5, 100)).toBeCloseTo(0.5);
  });
  it('un prix raisonnable est accepté : vente au prix proposé, argent encaissé, réputation + stock', () => {
    const p = avecOffre(); const e = evaluerOffre(p, 1); const t = p.tresorerie; const rep = p.reputation;
    const r = proposerPrix(p, 1, e.prixReference * 1.02);
    expect(r.accepte).toBe(true);
    expect(p.tresorerie - t).toBeCloseTo(100 * e.prixReference * 1.02);
    expect(p.reputation).toBe(rep + 2); expect(p.stock[0].n).toBe(2900); expect(p.offres).toHaveLength(0);
  });
  it('un prix excessif est refusé ; le client contre-propose ; après deux refus il s\'en va', () => {
    const p = avecOffre(); const e = evaluerOffre(p, 1);
    const r1 = proposerPrix(p, 1, e.prixMax * 1.5);
    expect(r1.accepte).toBe(false); expect(r1.termine).toBe(false); expect(r1.contreProposition).toBeGreaterThan(e.prixReference);
    expect(p.stock[0].n).toBe(3000);
    const r2 = proposerPrix(p, 1, e.prixMax * 1.5);
    expect(r2.accepte).toBe(false); expect(r2.termine).toBe(true); expect(p.offres).toHaveLength(0);
  });
  it('on peut accepter la contre-proposition', () => {
    const p = avecOffre(); const e = evaluerOffre(p, 1);
    const r = proposerPrix(p, 1, e.prixMax * 1.4);
    const ok = proposerPrix(p, 1, r.contreProposition!);
    expect(ok.ok).toBe(true);
  });
  it('entre 95 et 120 % : le tirage au sort dépend de la graine (reproductible), et les deux issues arrivent', () => {
    const issues = new Set<boolean>();
    for (let g = 1; g <= 40; g++) { const p = avecOffre(); p.rng = g; const e = evaluerOffre(p, 1); issues.add(proposerPrix(p, 1, e.prixMax * 1.08).accepte === true); }
    expect(issues.size).toBe(2);
  });
  it('accepter au prix de référence marche toujours', () => {
    for (let g = 1; g <= 20; g++) { const p = avecOffre(); p.rng = g; expect(accepterOffre(p, 1).ok).toBe(true); }
  });
  it('peut vendre sous le prix de revient (le joueur est libre, la perte se voit dans le bilan)', () => {
    const p = avecOffre(); p.stock[0].cout = 30; p.stock[0].coutMatiere = 20;
    const e = evaluerOffre(p, 1); expect(e.margeReference).toBeLessThan(0);
    expect(proposerPrix(p, 1, e.prixReference).accepte).toBe(true);
    expect(p.coutVentesAn).toBeGreaterThan(p.caBouteillesAn);
  });
});
