import { describe, it, expect } from 'vitest';
import { LIEUX, PARCELLES, VIGNES_VOISINS, pointArrivee } from '../src/world/lieux';
import { BORNES, hauteurTerrain } from '../src/world/terrain';
import { obstacles } from '../src/world/construction';

describe('village de Saint-Aubin-les-Craies', () => {
  it('contient les 12 lieux du GDD', () => {
    expect(LIEUX).toHaveLength(12);
    expect(new Set(LIEUX.map((l) => l.id)).size).toBe(12);
  });
  it('a 5 parcelles aux bonnes surfaces et cépages', () => {
    expect(Object.values(PARCELLES).map((p) => p.ha).reduce((a, b) => a + b, 0)).toBeCloseTo(3.6);
    expect(PARCELLES.crayeres.cepage).toBe('chardonnay');
    expect(PARCELLES.mont_benoit.cepage).toBe('pinot noir');
    expect(PARCELLES.hautes_vignes.cepage).toBe('meunier');
  });
  it('place tous les lieux dans les limites, et on y arrive hors des obstacles', () => {
    const obs = obstacles();
    for (const l of LIEUX) {
      expect(l.x).toBeGreaterThan(BORNES.minX);
      expect(l.x).toBeLessThan(BORNES.maxX);
      expect(l.z).toBeGreaterThan(BORNES.minZ);
      expect(l.z).toBeLessThan(BORNES.maxZ);
      const a = pointArrivee(l);
      for (const o of obs) expect(Math.hypot(a.x - o.x, a.z - o.z)).toBeGreaterThanOrEqual(o.r - 0.01 - (o.x === l.x && o.z === l.z ? 0 : 0.6));
    }
  });
  it('les parcelles ne se chevauchent pas', () => {
    const r = [...Object.values(PARCELLES).map((p) => p.rect), ...VIGNES_VOISINS];
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i]; const b = r[j];
      const chevauche = a.xMin < b.xMax && b.xMin < a.xMax && a.zMin < b.zMax && b.zMin < a.zMax;
      expect(chevauche, `${i} et ${j}`).toBe(false);
    }
  });
  it('le coteau monte vers le nord et la Marne est en contrebas', () => {
    expect(hauteurTerrain(0, -60)).toBeGreaterThan(hauteurTerrain(0, 0) + 8);
    expect(hauteurTerrain(0, 60)).toBeLessThan(hauteurTerrain(0, 20));
  });
});
