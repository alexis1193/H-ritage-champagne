import { describe, it, expect } from 'vitest';
import { simuler } from '../../src/sim/simulateur';
import { copierParams } from '../../src/sim/params';

/**
 * Gardiens de l'équilibrage : ces tests rejouent 300 parties de 10 ans pour chacun des 4 profils
 * et vérifient les objectifs du GDD. Si on change un chiffre dans src/data/*.json et qu'un objectif casse, un test échoue.
 */
const res = simuler(300, copierParams(), 10);
const [passif, prudent, ambitieux, negligent] = res;

describe('objectifs d\'équilibrage (GDD)', () => {
  it('1. passif : survit, gagne 10 000 à 20 000 € par an, réputation sous 15', () => {
    expect(passif.tauxFaillite).toBeLessThan(0.02);
    const gain = (passif.patrimoineAn[9] - passif.patrimoineAn[3]) / 6;
    expect(gain).toBeGreaterThan(10000); expect(gain).toBeLessThan(20000);
    expect(Math.max(...passif.reputationAn)).toBeLessThan(15);
  });
  it('2. prudent : trésorerie jamais sous −20 000 €, dépasse le passif dès l\'an 4, réputation 40 en an 6', () => {
    expect(prudent.tauxFaillite).toBe(0);
    expect(prudent.minTresorerieP10).toBeGreaterThan(-20000);
    for (let k = 3; k < 10; k++) expect(prudent.patrimoineAn[k]).toBeGreaterThan(passif.patrimoineAn[k]);
    expect(prudent.reputationAn[5]).toBeGreaterThan(35); expect(prudent.reputationAn[5]).toBeLessThan(48);
  });
  it('3. ambitieux : vrai risque de faillite en an 2 ou 3, mais le meilleur résultat en an 10 s\'il tient', () => {
    expect(ambitieux.faillitesAn[2]).toBeGreaterThan(0.1); expect(ambitieux.faillitesAn[2]).toBeLessThan(0.5);
    expect(ambitieux.patrimoineAn[9]).toBeGreaterThan(prudent.patrimoineAn[9]);
    expect(ambitieux.patrimoineAn[9]).toBeGreaterThan(passif.patrimoineAn[9]);
  });
  it('4. négligent : vigne dégradée, faillite probable avant l\'an 5', () => {
    expect(negligent.faillitesAn[3]).toBeGreaterThan(0.6);
  });
  it('5. première vente de bouteilles sous sa marque vers le mois 16', () => {
    expect(prudent.premiereVente).toBeGreaterThanOrEqual(15.5); expect(prudent.premiereVente).toBeLessThanOrEqual(17.5);
  });
  it('6. (rythme) un joueur actif prend au moins 30 décisions par an ; la durée minimale d\'une année est garantie par l\'interface (étape 3)', () => {
    expect(prudent.actionsParAn).toBeGreaterThan(30);
    expect(ambitieux.actionsParAn).toBeGreaterThan(30);
  });
});
