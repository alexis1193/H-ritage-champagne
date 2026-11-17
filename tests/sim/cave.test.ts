import { describe, it, expect } from 'vitest';
import { neuve, allerAu, sansMeteo } from './aide';
import { presserRaisins, vendreRaisins, choisirMalo, apercuAssemblage, tirer, degorger, versLaReserve, bonusAge } from '../../src/sim/vin';
import { finDuMois } from '../../src/sim/mois';
import { investir } from '../../src/sim/finance';
import { placesLibres } from '../../src/sim/partie';

const septembre = () => { const p = neuve(sansMeteo); allerAu(p, 8); p.raisins.push({ cepage: 'chardonnay', kg: 4000, qualite: 55 }, { cepage: 'pinot noir', kg: 8000, qualite: 52 }); return p; };

describe('pressoir', () => {
  it('un marc de 4 000 kg donne 2 050 L de cuvée ; cuvée seule : qualité +2', () => {
    const p = septembre();
    expect(presserRaisins(p, 'chardonnay', 4000, { garderTaille: false }).ok).toBe(true);
    const l = p.lots.find((x) => x.annee === 2027)!;
    expect(l.litres).toBe(2050); expect(l.qualite).toBe(57);
  });
  it('garder la taille : 2 550 L mais qualité −2', () => {
    const p = septembre(); presserRaisins(p, 'chardonnay', 4000, { garderTaille: true });
    const l = p.lots.find((x) => x.annee === 2027)!;
    expect(l.litres).toBe(2550); expect(l.qualite).toBe(53);
  });
  it('sans pressoir : 0,35 €/kg à la coopérative ; avec pressoir : gratuit', () => {
    const p = septembre(); const t = p.tresorerie; presserRaisins(p, 'chardonnay', 4000);
    expect(t - p.tresorerie).toBeGreaterThanOrEqual(1400);
    const q = septembre(); q.tresorerie = 200000; investir(q, 'pressoir'); const t2 = q.tresorerie; q.cuverieLitres = 99999; presserRaisins(q, 'chardonnay', 4000);
    expect(q.tresorerie).toBe(t2);
  });
  it('au-delà de la cuverie : vinification à façon, 1 € par litre', () => {
    const p = septembre(); p.pressoir = true; p.cuverieLitres = 1000;
    const t = p.tresorerie; presserRaisins(p, 'chardonnay', 4000);
    expect(t - p.tresorerie).toBeCloseTo(1050);
  });
  it('vendre au négoce : prix du marché, ou du contrat s\'il est signé ; 15 % de moins pour le non-pressé de fin octobre', () => {
    const p = septembre(); p.prixMarche = 7; const t = p.tresorerie;
    vendreRaisins(p, 'chardonnay', 1000); expect(p.tresorerie - t).toBeCloseTo(7000);
    p.contratPrix = 7.5; const t2 = p.tresorerie; vendreRaisins(p, 'chardonnay', 1000); expect(p.tresorerie - t2).toBeCloseTo(7500);
    const q = septembre(); q.prixMarche = 7; allerAu(q, 9); q.raisins = [{ cepage: 'chardonnay', kg: 1000, qualite: 55 }]; const t3 = q.tresorerie;
    finDuMois(q); expect(q.raisins).toHaveLength(0);
    expect(q.tresorerie).toBeGreaterThan(t3 + 5900 - 20000); // vendu 7 × 0,85 = 5 950 € (les charges du mois s'y ajoutent)
  });
  it('hors saison : on ne presse pas', () => {
    const p = neuve(); p.raisins.push({ cepage: 'chardonnay', kg: 1000, qualite: 55 });
    expect(presserRaisins(p, 'chardonnay', 1000).ok).toBe(false);
  });
});

describe('malolactique, assemblage et tirage', () => {
  it('malolactique d\'octobre à décembre : le style rond ajoute +1', () => {
    const p = septembre(); presserRaisins(p, 'chardonnay', 4000); allerAu(p, 9);
    const l = p.lots.find((x) => x.annee === 2027)!;
    expect(choisirMalo(p, l.id, 'rond').ok).toBe(true); expect(l.qualite).toBe(58); expect(choisirMalo(p, l.id, 'vif').ok).toBe(false);
  });
  it('bonus : trois cépages à 15 % ou plus +4 ; 10 à 35 % de réserve +3 ; plus de 50 % de réserve −2', () => {
    const p = neuve();
    const [a, b, c] = p.lots;
    const base = apercuAssemblage(p, [{ lotId: a.id, litres: 1200 }, { lotId: b.id, litres: 800 }, { lotId: c.id, litres: 1000 }], 'brut_sans_annee');
    expect(base.bonus.troisCepages).toBe(4); expect(base.qualite).toBe(58);
    const deux = apercuAssemblage(p, [{ lotId: a.id, litres: 1200 }, { lotId: c.id, litres: 1000 }], 'brut_sans_annee');
    expect(deux.bonus.troisCepages).toBe(0);
    a.reserve = true;
    const r25 = apercuAssemblage(p, [{ lotId: a.id, litres: 500 }, { lotId: b.id, litres: 800 }, { lotId: c.id, litres: 700 }], 'brut_sans_annee');
    expect(r25.bonus.reserve).toBe(3);
    const r60 = apercuAssemblage(p, [{ lotId: a.id, litres: 1200 }, { lotId: c.id, litres: 800 }], 'brut_sans_annee');
    expect(r60.bonus.reserve).toBe(-2);
  });
  it('cuvées : blanc de blancs 100 % chardonnay, rosé ≥ 15 % de rouge, millésimé = une année exceptionnelle sans réserve', () => {
    const p = neuve(); const [a, b, c] = p.lots; // a = pinot noir (rouge), b = meunier, c = chardonnay
    expect(apercuAssemblage(p, [{ lotId: c.id, litres: 1000 }], 'blanc_de_blancs').ok).toBe(true);
    expect(apercuAssemblage(p, [{ lotId: c.id, litres: 500 }, { lotId: b.id, litres: 500 }], 'blanc_de_blancs').ok).toBe(false);
    expect(apercuAssemblage(p, [{ lotId: c.id, litres: 800 }, { lotId: a.id, litres: 200 }], 'rose').ok).toBe(true);
    expect(apercuAssemblage(p, [{ lotId: c.id, litres: 950 }, { lotId: a.id, litres: 50 }], 'rose').ok).toBe(false);
    expect(apercuAssemblage(p, [{ lotId: c.id, litres: 1000 }], 'millesime').ok).toBe(false);
    p.millesimes.push(2026);
    expect(apercuAssemblage(p, [{ lotId: c.id, litres: 1000 }], 'millesime').ok).toBe(true);
    c.reserve = true; expect(apercuAssemblage(p, [{ lotId: c.id, litres: 1000 }], 'millesime').ok).toBe(false);
  });
  it('tirage : 1,80 € par bouteille (0,75 L), de janvier à juin, dans la limite des places de la cave', () => {
    const p = neuve(); const t = p.tresorerie;
    const r = tirer(p, p.lots.map((l) => ({ lotId: l.id, litres: l.litres })), 'brut_sans_annee');
    expect(r.ok).toBe(true);
    expect(p.lattes[0].n).toBe(4000); expect(t - p.tresorerie).toBeCloseTo(7200);
    expect(placesLibres(p)).toBe(8000 - 600 - 4000);
    allerAu(p, 6); p.lots.push({ id: 99, cepage: 'meunier', litres: 100, qualite: 50, annee: 2027, rouge: false, style: 'vif', reserve: false });
    expect(tirer(p, [{ lotId: 99, litres: 100 }], 'brut_sans_annee').ok).toBe(false); // juillet : trop tard
  });
  it('cave pleine : refus clair', () => {
    const p = neuve(); p.cavePlaces = 1000;
    const r = tirer(p, p.lots.map((l) => ({ lotId: l.id, litres: l.litres })), 'brut_sans_annee');
    expect(r.ok).toBe(false); expect(r.erreur).toContain('place');
    investir(p, 'cave'); expect(p.cavePlaces).toBe(11000);
  });
  it('fin juin : les vins clairs restants partent en réserve', () => {
    const p = neuve(sansMeteo); allerAu(p, 5); finDuMois(p);
    expect(p.lots.every((l) => l.reserve)).toBe(true);
    void versLaReserve;
  });
});

describe('vieillissement, dégorgement et dosage', () => {
  const lattes = (age: number, qualite = 60) => { const p = neuve(sansMeteo); allerAu(p, 6); p.lattes.push({ id: 50, n: 1000, qualite, cuvee: 'brut_sans_annee', moisTirage: 0, millesime: null, age }); p.jours = 10; return p; };
  it('bonus d\'âge : +2 par tranche de 6 mois au-delà du minimum, maximum +8', () => {
    const p = neuve();
    expect(bonusAge(p, 15, 15)).toBe(0); expect(bonusAge(p, 20, 15)).toBe(0); expect(bonusAge(p, 21, 15)).toBe(2); expect(bonusAge(p, 33, 15)).toBe(6); expect(bonusAge(p, 80, 15)).toBe(8);
  });
  it('refuse de dégorger un vin trop jeune (15 mois ; 36 pour un millésimé)', () => {
    expect(degorger(lattes(14), 50, 100, 'brut').ok).toBe(false);
    expect(degorger(lattes(15), 50, 100, 'brut').ok).toBe(true);
    const p = lattes(20); p.lattes[0].cuvee = 'millesime'; expect(degorger(p, 50, 100, 'brut').ok).toBe(false);
  });
  it('1,10 € par bouteille ; remuage à la main : 1 jour pour 800 bouteilles ; gyropalettes : 0,15 € et aucun jour', () => {
    const p = lattes(15); const t = p.tresorerie; degorger(p, 50, 800, 'brut');
    expect(t - p.tresorerie).toBeCloseTo(880); expect(p.jours).toBeCloseTo(9);
    const q = lattes(15); q.gyropalettes = true; const t2 = q.tresorerie; degorger(q, 50, 800, 'brut');
    expect(t2 - q.tresorerie).toBeCloseTo(880 + 120); expect(q.jours).toBe(10);
  });
  it('qualité finale = qualité + bonus d\'âge ; brut nature sous 65 perd 4 points ; 7 dosages', () => {
    const p = lattes(27, 60); degorger(p, 50, 500, 'brut'); expect(p.stock.at(-1)!.qualite).toBe(64);
    const q = lattes(15, 60); degorger(q, 50, 500, 'brut nature'); expect(q.stock.at(-1)!.qualite).toBe(56);
    const r = lattes(15, 70); degorger(r, 50, 500, 'brut nature'); expect(r.stock.at(-1)!.qualite).toBe(70);
  });
  it('les bouteilles vieillissent d\'un mois à chaque fin de mois', () => {
    const p = lattes(15); finDuMois(p); expect(p.lattes.find((l) => l.id === 50)!.age).toBe(16);
  });
});
