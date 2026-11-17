import { describe, it, expect, beforeAll } from 'vitest';
import hautvillers from '../src/data/cartes/hautvillers.json';
import { installerCarte } from '../src/cartes/chargeur';
import type { DonneesCarte } from '../src/cartes/types';
import { LIEUX, PARCELLES, pointArrivee } from '../src/world/lieux';
import { BORNES, hauteurTerrain } from '../src/world/terrain';
import { Obstacles } from '../src/world/collision';
import { niveauAngle } from '../src/world/rangs';

const carte = hautvillers as unknown as DonneesCarte;
beforeAll(() => installerCarte(carte));

describe('carte réelle de Hautvillers (IGN)', () => {
  it('contient les 12 lieux du jeu', () => {
    expect(LIEUX.map((l) => l.id).sort()).toEqual(['cave', 'chateau', 'eglise', 'loge', 'maison', 'notaire', 'parcelle1', 'parcelle2', 'parcelle3', 'parcelle4', 'parcelle5', 'pressoir']);
  });
  it('a 5 parcelles aux bonnes surfaces et cépages, posées sur des vignes réelles', () => {
    const p = Object.values(PARCELLES);
    expect(p.reduce((a, b) => a + b.ha, 0)).toBeCloseTo(3.6);
    expect(p.map((x) => x.cepage).sort()).toEqual(['chardonnay', 'chardonnay', 'meunier', 'pinot noir', 'pinot noir']);
    for (const x of p) expect(x.nom.length).toBeGreaterThan(3);
  });
  it('place tous les lieux dans les limites, et on y arrive hors des bâtiments', () => {
    const obs = new Obstacles(carte);
    for (const l of LIEUX) {
      expect(l.x).toBeGreaterThan(BORNES.minX); expect(l.x).toBeLessThan(BORNES.maxX);
      expect(l.z).toBeGreaterThan(BORNES.minZ); expect(l.z).toBeLessThan(BORNES.maxZ);
      const a = pointArrivee(l);
      expect(obs.dansBatiment(a.x, a.z, 0.5), `arrivée de ${l.id}`).toBe(false);
    }
  });
  it("l'église abbatiale est à l'origine de la carte", () => {
    const e = LIEUX.find((l) => l.id === 'eglise');
    expect(Math.hypot(e?.x ?? 99, e?.z ?? 99)).toBeLessThan(30);
  });
  it('le relief est réel : le village est bien plus haut que la Marne (≈ 70 m contre ≈ 150 m)', () => {
    expect(hauteurTerrain(0, 0)).toBeGreaterThan(40);
    expect(hauteurTerrain(0, 0)).toBeLessThan(150);
    expect(hauteurTerrain(-150, 1150)).toBeLessThan(10); // la Marne, au sud
    expect(carte.altitudeMin).toBeGreaterThan(50);
  });
  it('le joueur ne traverse pas un bâtiment', () => {
    const obs = new Obstacles(carte);
    const m = LIEUX.find((l) => l.id === 'maison');
    expect(m).toBeDefined();
    const p = { x: m?.x ?? 0, z: m?.z ?? 0 };
    obs.resoudre(p);
    expect(obs.dansBatiment(p.x, p.z, 0)).toBe(false);
  });
  it("l'orientation des rangs est un niveau valide (0 à 31)", () => {
    for (const [i, j] of [[10, 10], [12, 20], [5, 28]]) { const k = niveauAngle(i, j); expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThan(32); }
  });
});
