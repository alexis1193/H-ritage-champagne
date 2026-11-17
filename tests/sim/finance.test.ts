import { describe, it, expect } from 'vitest';
import { neuve, allerAu, sansMeteo } from './aide';
import { emprunter, plafondEmprunt, investir, louerParcelle, acheterParcelle, embaucherChef, licencierChef, payerCharges, acompteImpots, finDAnnee, patrimoine } from '../../src/sim/finance';
import { finDuMois } from '../../src/sim/mois';
import { encaisser } from '../../src/sim/partie';
import { serialiser, deserialiser, versCode, depuisCode } from '../../src/sim/sauvegarde';
import { moisCourant, anneeCourante } from '../../src/sim/partie';

describe('banque', () => {
  it('plafond : 120 000 € + 300 000 € par hectare possédé', () => {
    const p = neuve(); expect(plafondEmprunt(p)).toBe(120000 + 300000 * 2);
    expect(emprunter(p, 720000).ok).toBe(true); expect(emprunter(p, 1).ok).toBe(false);
  });
  it('intérêts 4,5 % par an, versés chaque mois', () => {
    const p = neuve(); emprunter(p, 120000); const t = p.tresorerie; payerCharges(p);
    expect(t - p.tresorerie).toBeCloseTo(2000 + 4000 + (120000 * 0.045) / 12);
  });
  it('10 % du capital emprunté est remboursé chaque 31 décembre', () => {
    const p = neuve(sansMeteo); emprunter(p, 100000); allerAu(p, 11);
    finDuMois(p); // décembre
    expect(p.emprunt).toBeCloseTo(90000);
  });
  it('le découvert coûte des agios ; sous le seuil de faillite, c\'est la faillite', () => {
    const p = neuve(); p.tresorerie = -10000; const t = p.tresorerie; payerCharges(p);
    expect(t - p.tresorerie).toBeGreaterThan(6000 + (10000 * 0.09) / 12 - 1);
    const q = neuve(sansMeteo); q.tresorerie = q.params.charges.seuilFaillite - 1; finDuMois(q); expect(q.faillite).toBe(true);
  });
});

describe('investissements et charges', () => {
  it('prix du jeu : marque 9 000, boutique 6 000, caveau 70 000, antigel 18 000, pressoir 60 000, cuverie 20 000, cave 35 000, gyropalettes 25 000', () => {
    const p = neuve(); p.tresorerie = 1000000;
    for (const [k, prix] of [['marque', 9000], ['boutique', 6000], ['caveau', 70000], ['antigel', 18000], ['pressoir', 60000], ['cuverie', 20000], ['cave', 35000], ['gyropalettes', 25000]] as const) {
      const t = p.tresorerie; expect(investir(p, k).ok).toBe(true); expect(t - p.tresorerie).toBe(prix);
    }
    expect(p.cuverieLitres).toBe(5000); expect(p.cavePlaces).toBe(18000); expect(investir(p, 'marque').ok).toBe(false);
  });
  it('boutique et caveau demandent une marque ; la banque refuse un trou trop profond', () => {
    const p = neuve(); expect(investir(p, 'boutique').ok).toBe(false);
    p.tresorerie = -49000; expect(investir(p, 'marque').ok).toBe(false);
  });
  it('rémunération 2 000 €/mois, chef de culture 3 200 €/mois (+6 jours), fermage 14 000 €/an', () => {
    const p = neuve(); embaucherChef(p); expect(p.jours).toBe(16);
    louerParcelle(p, 'parcelle4');
    const t = p.tresorerie; payerCharges(p);
    expect(t - p.tresorerie).toBeCloseTo(2000 + 4000 + 3200 + 14000 / 12);
    licencierChef(p); expect(p.jours).toBe(10);
  });
  it('acheter les Côtes à Bras : 680 000 €, il faut emprunter', () => {
    const p = neuve(); expect(acheterParcelle(p, 'parcelle5').ok).toBe(false);
    p.tresorerie = 700000; expect(acheterParcelle(p, 'parcelle5').ok).toBe(true); expect(p.parcelles.find((x) => x.id === 'parcelle5')!.statut).toBe('possedee');
    expect(plafondEmprunt(p)).toBe(120000 + 300000 * 2.6);
  });
});

describe('impôts, succession, bilan', () => {
  it('impôts : 25 % du résultat annuel positif, payés par acomptes trimestriels', () => {
    const p = neuve(); encaisser(p, 100000, 'raisins');
    const t = p.tresorerie; acompteImpots(p); expect(t - p.tresorerie).toBeCloseTo(25000);
    encaisser(p, 20000, 'raisins'); const t2 = p.tresorerie; acompteImpots(p); expect(t2 - p.tresorerie).toBeCloseTo(5000);
  });
  it('pas d\'impôt sur un résultat négatif ; l\'excédent d\'acomptes est remboursé en fin d\'année', () => {
    const p = neuve(); expect(acompteImpots(p)).toBe(0);
    encaisser(p, 100000, 'raisins'); acompteImpots(p); p.resultatAn = 20000; const t = p.tresorerie; const b = finDAnnee(p);
    expect(b.impots).toBeCloseTo(5000); expect(p.tresorerie - t).toBeCloseTo(20000 - 25000); // remboursement de 20 000 € d'acomptes − 25 000 € de droits de succession
  });
  it('droits de succession : 25 000 € chaque 31 décembre pendant 3 ans (75 000 € en tout)', () => {
    const p = neuve(sansMeteo); p.tresorerie = 1000000;
    for (let an = 0; an < 4; an++) { const avant = p.successionRestante; allerAu(p, 11); finDuMois(p); expect(avant - p.successionRestante).toBe(an < 3 ? 25000 : 0); }
    expect(p.successionRestante).toBe(0);
  });
  it('bilan annuel : chiffre d\'affaires, charges, résultat, trésorerie', () => {
    const p = neuve(sansMeteo); allerAu(p, 11); const r = finDuMois(p);
    expect(r.bilan).not.toBeNull(); expect(r.bilan!.annee).toBe(2027); expect(p.bilans).toHaveLength(1);
    expect(r.bilan!.charges).toBeGreaterThan(70000);
  });
  it('patrimoine : trésorerie − dettes + stock + investissements', () => {
    const p = neuve(); const a = patrimoine(p); expect(a).toBeLessThan(40000); // −75 000 € de droits de succession à payer
    p.successionRestante = 0; expect(patrimoine(p)).toBeGreaterThan(a);
  });
});

describe('fin de mois et sauvegarde', () => {
  it('avance le calendrier, remet les jours à 10 (16 avec chef), janvier 2027 → décembre 2027 → janvier 2028', () => {
    const p = neuve(sansMeteo); expect(moisCourant(p)).toBe(0); finDuMois(p); expect(moisCourant(p)).toBe(1);
    allerAu(p, 11); finDuMois(p); expect(moisCourant(p)).toBe(0); expect(anneeCourante(p)).toBe(2028);
    embaucherChef(p); finDuMois(p); expect(p.jours).toBe(16);
  });
  it('le résumé donne les événements, les comptes du mois et la trésorerie avant/après', () => {
    const p = neuve(sansMeteo); const r = finDuMois(p);
    expect(r.comptes.depenses['rémunération']).toBe(2000); expect(r.tresorerieAvant).toBe(40000); expect(r.tresorerieApres).toBeLessThan(40000);
  });
  it('sauvegarde et rechargement donnent exactement la même partie ; code d\'export à copier', () => {
    const p = neuve(undefined, 9); for (let i = 0; i < 20; i++) finDuMois(p);
    const q = deserialiser(serialiser(p), p.params);
    expect(q).toEqual(p);
    const r = depuisCode(versCode(p), p.params);
    expect(r).toEqual(p);
    finDuMois(q); finDuMois(p); expect(q.tresorerie).toBeCloseTo(p.tresorerie); // même suite après reprise
  });
});
