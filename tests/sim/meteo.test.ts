import { describe, it, expect } from 'vitest';
import { neuve, allerAu, sansMeteo, parc } from './aide';
import type { Partie } from '../../src/sim/types';
import { appliquerMeteo } from '../../src/sim/vigne';
import { finDuMois } from '../../src/sim/mois';

/** Va au mois voulu puis remet les jauges de la vigne à leur état neuf (les oublis des mois passés ne comptent pas ici). */
const va = (p: Partie, m: number): void => { allerAu(p, m); for (const x of p.parcelles) { x.facteurRecolte = 1; x.sante = 85; x.qualiteAjust = 0; x.faits.protection = false; } p.bonusMillesime = 0; };
const seul = (id: string, f: (p: ReturnType<typeof neuve>['params']) => void) => neuve((x) => { sansMeteo(x); f(x); void id; });

describe('météo', () => {
  it('gel d\'avril : récolte −20 à −45 % sur toutes les parcelles', () => {
    const p = seul('gel', (x) => { x.meteo.gel.proba = 1; }); va(p, 3);
    appliquerMeteo(p, []);
    for (const id of ['parcelle1', 'parcelle2', 'parcelle3']) { const f = parc(p, id).facteurRecolte; expect(f).toBeGreaterThanOrEqual(0.55); expect(f).toBeLessThanOrEqual(0.8); }
  });
  it('la protection antigel divise la perte par deux', () => {
    const a = seul('gel', (x) => { x.meteo.gel.proba = 1; x.meteo.gel.min = 0.4; x.meteo.gel.max = 0.4; }); va(a, 3);
    const b = seul('gel', (x) => { x.meteo.gel.proba = 1; x.meteo.gel.min = 0.4; x.meteo.gel.max = 0.4; }); va(b, 3); b.antigel = true;
    appliquerMeteo(a, []); appliquerMeteo(b, []);
    expect(parc(a, 'parcelle1').facteurRecolte).toBeCloseTo(0.6);
    expect(parc(b, 'parcelle1').facteurRecolte).toBeCloseTo(0.8);
  });
  it('coulure de juin : récolte −8 à −18 %', () => {
    const p = seul('c', (x) => { x.meteo.coulure.proba = 1; }); va(p, 5); appliquerMeteo(p, []);
    const f = parc(p, 'parcelle1').facteurRecolte; expect(f).toBeGreaterThanOrEqual(0.82); expect(f).toBeLessThanOrEqual(0.92);
  });
  it('belle floraison : récolte +5 % et +3 au bonus de millésime', () => {
    const p = seul('f', (x) => { x.meteo.floraison.proba = 1; x.meteo.coulure.proba = 0; }); va(p, 5); appliquerMeteo(p, []);
    expect(parc(p, 'parcelle1').facteurRecolte).toBeCloseTo(1.05); expect(p.bonusMillesime).toBe(3);
  });
  it('mildiou/oïdium sur vigne non protégée : santé −10 à −20, récolte −5 à −15 %', () => {
    const p = seul('m', (x) => { x.meteo.maladie.probaNonProtege = 1; }); va(p, 5);
    const a = parc(p, 'parcelle1'); a.faits.protection = false; const s = a.sante;
    appliquerMeteo(p, []);
    expect(s - a.sante).toBeGreaterThanOrEqual(10); expect(s - a.sante).toBeLessThanOrEqual(20);
    expect(a.facteurRecolte).toBeGreaterThanOrEqual(0.85); expect(a.facteurRecolte).toBeLessThanOrEqual(0.95);
  });
  it('grêle (juillet, août) : une seule parcelle perd 15 à 40 %', () => {
    const p = seul('g', (x) => { x.meteo.grele.proba = 1; }); va(p, 6); appliquerMeteo(p, []);
    const touchees = ['parcelle1', 'parcelle2', 'parcelle3'].filter((id) => parc(p, id).facteurRecolte < 1);
    expect(touchees).toHaveLength(1);
    const f = parc(p, touchees[0]).facteurRecolte; expect(f).toBeGreaterThanOrEqual(0.6); expect(f).toBeLessThanOrEqual(0.85);
  });
  it('canicule d\'août : récolte −5 % ; été idéal : +4 au bonus de millésime', () => {
    const a = seul('c', (x) => { x.meteo.canicule.proba = 1; }); va(a, 7); appliquerMeteo(a, []);
    expect(parc(a, 'parcelle1').facteurRecolte).toBeCloseTo(0.95);
    const b = seul('e', (x) => { x.meteo.eteIdeal.proba = 1; }); va(b, 7); appliquerMeteo(b, []);
    expect(b.bonusMillesime).toBe(4);
  });
  it('un millésime est déclaré si le bonus atteint 6 ou si la qualité moyenne atteint 72', () => {
    const a = neuve(sansMeteo); va(a, 8); a.bonusMillesime = 7; finDuMois(a);
    expect(a.millesimes).toContain(2027);
    const b = neuve(sansMeteo); va(b, 8); b.bonusMillesime = 5; finDuMois(b);
    expect(b.millesimes).toHaveLength(0);
    const c = neuve(sansMeteo); va(c, 8);
    for (const x of c.parcelles) { x.qualiteSouches = 80; x.recolteKg = 5000; x.faits.vendanges = true; x.vendangee = true; }
    finDuMois(c); expect(c.millesimes).toContain(2027);
  });
  it('le ban des vendanges annonce le rendement autorisé (10 000 à 12 000 kg/ha) et le prix du raisin (6,60 à 8,60 €)', () => {
    const p = neuve(sansMeteo); va(p, 6); finDuMois(p);
    expect(p.plafondHa).toBeGreaterThanOrEqual(10000); expect(p.plafondHa).toBeLessThanOrEqual(12000);
    expect(p.prixMarche).toBeGreaterThanOrEqual(6.6); expect(p.prixMarche).toBeLessThanOrEqual(8.6);
  });
  it('est reproductible : même graine, même météo', () => {
    const a = neuve(undefined, 5); const b = neuve(undefined, 5);
    for (let i = 0; i < 24; i++) { finDuMois(a); finDuMois(b); }
    expect(a.parcelles.map((x) => x.facteurRecolte)).toEqual(b.parcelles.map((x) => x.facteurRecolte));
  });
});
