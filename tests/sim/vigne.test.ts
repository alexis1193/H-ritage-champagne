import { describe, it, expect } from 'vitest';
import { neuve, allerAu, sansMeteo, parc } from './aide';
import { faireTravail, travauxDus, estimationRecolte, qualiteRaisins, systemeIdeal, systemePermis, coutJour, appliquerOublis, appliquerMeteo, nouvelleSaison, majSouches } from '../../src/sim/vigne';
import { finDuMois } from '../../src/sim/mois';

describe('départ', () => {
  it('janvier 2027, 40 000 €, 2 ha, 600 bouteilles et 3 000 L de vins clairs', () => {
    const p = neuve();
    expect(p.params.depart.annee).toBe(2027);
    expect(p.tresorerie).toBe(40000);
    expect(p.reputation).toBe(5);
    expect(p.parcelles.filter((x) => x.statut === 'possedee').reduce((s, x) => s + x.ha, 0)).toBeCloseTo(2);
    expect(p.stock[0]).toMatchObject({ n: 600, qualite: 55 });
    expect(p.lots.reduce((s, l) => s + l.litres, 0)).toBe(3000);
    expect(p.cavePlaces).toBe(8000);
    expect(p.pressoir).toBe(false);
    expect(p.jours).toBe(10);
  });
});

describe('travaux de la vigne', () => {
  it('soi-même : consomme des jours (5 jours par ha pour la taille)', () => {
    const p = neuve();
    expect(faireTravail(p, 'parcelle2', 'taille', 'soi', { systeme: 'cordon' }).ok).toBe(true); // 0,8 ha
    expect(p.jours).toBeCloseTo(6);
  });
  it('équipe : coûte des euros (3 500 € par ha pour la taille)', () => {
    const p = neuve();
    faireTravail(p, 'parcelle2', 'taille', 'equipe', { systeme: 'cordon' });
    expect(p.tresorerie).toBeCloseTo(40000 - 3500 * 0.8);
    expect(p.jours).toBe(10);
  });
  it('refuse un travail hors saison, déjà fait, ou sans assez de jours', () => {
    const p = neuve();
    expect(faireTravail(p, 'parcelle1', 'ebourgeonnage', 'soi').ok).toBe(false);
    faireTravail(p, 'parcelle1', 'taille', 'equipe', { systeme: 'chablis' });
    expect(faireTravail(p, 'parcelle1', 'taille', 'equipe', { systeme: 'chablis' }).ok).toBe(false);
    expect(faireTravail(p, 'parcelle2', 'taille', 'soi', { systeme: 'cordon' }).ok).toBe(true); // 4 jours
    expect(faireTravail(p, 'parcelle3', 'taille', 'soi', { systeme: 'vallee_marne' }).ok).toBe(true); // 2,5 jours
    expect(p.jours).toBeCloseTo(3.5);
    p.jours = 1;
    expect(faireTravail(p, 'parcelle4', 'taille', 'soi', { systeme: 'guyot' }).ok).toBe(false); // pas louée
  });
  it('taille : Vallée de la Marne est réservée au meunier ; le système idéal donne +3 de qualité', () => {
    expect(systemePermis('chardonnay', 'vallee_marne')).toBe(false);
    expect(systemePermis('pinot noir', 'vallee_marne')).toBe(false);
    expect(systemePermis('meunier', 'vallee_marne')).toBe(true);
    expect(systemePermis('pinot noir', 'guyot')).toBe(true);
    expect(systemeIdeal('chardonnay')).toBe('chablis');
    expect(systemeIdeal('pinot noir')).toBe('cordon');
    expect(systemeIdeal('meunier')).toBe('vallee_marne');
    const p = neuve();
    expect(faireTravail(p, 'parcelle1', 'taille', 'equipe', { systeme: 'vallee_marne' }).ok).toBe(false);
    faireTravail(p, 'parcelle1', 'taille', 'equipe', { systeme: 'chablis' });
    faireTravail(p, 'parcelle2', 'taille', 'equipe', { systeme: 'guyot' });
    expect(qualiteRaisins(p, parc(p, 'parcelle1'))).toBeCloseTo(55);
    expect(qualiteRaisins(p, parc(p, 'parcelle2'))).toBeCloseTo(52);
  });
  it('liste les travaux du mois et affiche le coût d\'un jour', () => {
    const p = neuve();
    expect(travauxDus(p).map((t) => t.travail.id)).toEqual(['taille', 'taille', 'taille']);
    const c = coutJour(p);
    expect(c.jourJoueur).toBe(200);
    expect(c.equipeParJour.taille).toBe(700);
  });
});

describe('oublis (pénalités de fin de mois)', () => {
  const finir = (mois: number, f: (p: ReturnType<typeof neuve>) => void = () => undefined) => {
    const p = neuve(sansMeteo);
    allerAu(p, mois);
    f(p);
    return p;
  };
  it('taille oubliée à la fin de mars : récolte −30 %, qualité −5', () => {
    const p = neuve(sansMeteo); allerAu(p, 2); finDuMois(p);
    expect(parc(p, 'parcelle1').facteurRecolte).toBeCloseTo(0.7);
    expect(parc(p, 'parcelle1').qualiteAjust).toBe(-5);
  });
  it('taille faite : pas de pénalité', () => {
    const p = neuve(sansMeteo);
    for (const id of ['parcelle1', 'parcelle2', 'parcelle3']) faireTravail(p, id, 'taille', 'equipe', { systeme: 'guyot' });
    allerAu(p, 2); for (const id of ['parcelle1', 'parcelle2', 'parcelle3']) expect(parc(p, id).faits.taille).toBe(true);
  });
  it('liage oublié : santé −6 ; ébourgeonnage : qualité −4 et santé −5 ; palissage : santé −8, qualité −2 ; rognage : qualité −2', () => {
    const p = neuve(sansMeteo);
    for (const id of ['parcelle1', 'parcelle2', 'parcelle3']) faireTravail(p, id, 'taille', 'equipe', { systeme: 'guyot' });
    const s0 = parc(p, 'parcelle1').sante;
    allerAu(p, 4); // fin d'avril passée : liage oublié
    expect(parc(p, 'parcelle1').sante).toBe(s0 - 6);
    const q0 = parc(p, 'parcelle1').qualiteAjust; const s1 = parc(p, 'parcelle1').sante;
    allerAu(p, 5); // fin de mai : ébourgeonnage oublié
    expect(parc(p, 'parcelle1').qualiteAjust).toBe(q0 - 4);
    expect(parc(p, 'parcelle1').sante).toBe(s1 - 5);
    allerAu(p, 7); // fin de juillet : palissage (−8, −2) et rognage (−2)
    expect(parc(p, 'parcelle1').qualiteAjust).toBe(q0 - 4 - 2 - 2);
    expect(parc(p, 'parcelle1').sante).toBe(s1 - 5 - 8);
  });
  it('vendanges oubliées : la récolte est perdue', () => {
    const p = neuve(sansMeteo); allerAu(p, 8); finDuMois(p);
    expect(parc(p, 'parcelle1').recolteKg).toBe(0);
    expect(p.raisins).toHaveLength(0);
  });
  it('labour et buttage oubliés : santé −4 chacun', () => {
    const p = neuve(sansMeteo); allerAu(p, 9);
    const s = parc(p, 'parcelle1').sante;
    finDuMois(p); expect(parc(p, 'parcelle1').sante).toBe(s - 4); // labour d'octobre
    finDuMois(p); expect(parc(p, 'parcelle1').sante).toBe(s - 8); // buttage de novembre
  });
  it('protection oubliée : risque de maladie 45 % au lieu de 5 %', () => {
    const p = neuve((x) => { sansMeteo(x); x.meteo.maladie.probaProtege = 0; x.meteo.maladie.probaNonProtege = 1; });
    allerAu(p, 4);
    const a = parc(p, 'parcelle1');
    a.faits.protection = false;
    const s = a.sante; const ev: string[] = [];
    appliquerMeteo(p, ev);
    expect(a.sante).toBeLessThanOrEqual(s - 10);
    expect(a.facteurRecolte).toBeLessThan(0.96);
    const b = neuve((x) => { sansMeteo(x); x.meteo.maladie.probaProtege = 0; });
    allerAu(b, 4); parc(b, 'parcelle1').faits.protection = true;
    const avant = parc(b, 'parcelle1').sante;
    appliquerMeteo(b, []); expect(parc(b, 'parcelle1').sante).toBe(avant);
  });
  it('souches : +2 si la vigne est bien soignée, −2 sinon (au 31 décembre)', () => {
    const p = neuve(sansMeteo);
    parc(p, 'parcelle1').oublisAn = 0; parc(p, 'parcelle2').oublisAn = 2;
    majSouches(p);
    expect(parc(p, 'parcelle1').qualiteSouches).toBe(54);
    expect(parc(p, 'parcelle2').qualiteSouches).toBe(50);
  });
  it('nouvelle saison : la santé revient à la base et les jauges annuelles sont remises à zéro', () => {
    const p = neuve(); const a = parc(p, 'parcelle1'); a.sante = 40; a.qualiteAjust = -9; a.faits.taille = true;
    nouvelleSaison(p);
    expect(a.sante).toBe(85); expect(a.qualiteAjust).toBe(0); expect(a.faits.taille).toBeUndefined();
  });
  void finir; void appliquerOublis;
});

describe('récolte', () => {
  it('= ha × 11 500 kg × effets × (0,6 + 0,4 × santé/100), plafonnée au rendement autorisé', () => {
    const p = neuve(); const a = parc(p, 'parcelle2'); // 0,8 ha
    p.plafondHa = 99999;
    expect(estimationRecolte(p, a)).toBe(Math.round(0.8 * 11500 * (0.6 + 0.4 * 0.85)));
    a.facteurRecolte = 0.7;
    expect(estimationRecolte(p, a)).toBe(Math.round(0.8 * 11500 * 0.7 * (0.6 + 0.4 * 0.85)));
    a.facteurRecolte = 1; p.plafondHa = 10000;
    expect(estimationRecolte(p, a)).toBe(8000);
  });
  it('vendanges : les raisins arrivent en stock avec leur qualité ; payés à 0,90 €/kg en fin de mois si par équipe', () => {
    const p = neuve(sansMeteo); allerAu(p, 8);
    for (const id of ['parcelle1', 'parcelle2', 'parcelle3']) expect(faireTravail(p, id, 'vendanges', 'equipe').ok).toBe(true);
    const kg = p.raisins.reduce((s, r) => s + r.kg, 0);
    expect(kg).toBeGreaterThan(10000); // sans taille ni soins : récolte réduite
    expect(p.cueilletteAPayer).toBeCloseTo(kg * 0.9);
    const avant = p.tresorerie;
    finDuMois(p);
    expect(p.tresorerie).toBeLessThan(avant - kg * 0.9 + 1);
  });
});
