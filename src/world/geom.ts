import type { DonneesCarte } from '../cartes/types';

/** Petits outils géométriques partagés. */
export function dansPoly(x: number, z: number, p: Float32Array): boolean {
  let d = false;
  for (let a = 0, b = p.length - 2; a < p.length; b = a, a += 2) {
    if ((p[a + 1] > z) !== (p[b + 1] > z) && x < ((p[b] - p[a]) * (z - p[a + 1])) / (p[b + 1] - p[a + 1]) + p[a]) d = !d;
  }
  return d;
}

/** Fabrique un test « ce point est-il sur une route ou un chemin (largeur + marge) ? ». */
export function creerSurRoute(d: DonneesCarte): (x: number, z: number) => boolean {
  const SEG = 40;
  const segs = new Map<number, number[]>();
  for (const r of d.routes) {
    for (let a = 0; a + 3 < r.p.length; a += 2) {
      const s = [r.p[a], r.p[a + 1], r.p[a + 2], r.p[a + 3], r.w / 2 + 1.2];
      const x0 = Math.floor(Math.min(s[0], s[2]) / SEG); const x1 = Math.floor(Math.max(s[0], s[2]) / SEG);
      const z0 = Math.floor(Math.min(s[1], s[3]) / SEG); const z1 = Math.floor(Math.max(s[1], s[3]) / SEG);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const l = segs.get(i * 10000 + j); if (l) l.push(...s); else segs.set(i * 10000 + j, [...s]); }
    }
  }
  return (x, z) => {
    const l = segs.get(Math.floor(x / SEG) * 10000 + Math.floor(z / SEG));
    if (!l) return false;
    for (let a = 0; a < l.length; a += 5) {
      const dx = l[a + 2] - l[a]; const dz = l[a + 3] - l[a + 1];
      const t = Math.max(0, Math.min(1, ((x - l[a]) * dx + (z - l[a + 1]) * dz) / (dx * dx + dz * dz || 1e-9)));
      if (Math.hypot(x - (l[a] + t * dx), z - (l[a + 1] + t * dz)) < l[a + 4]) return true;
    }
    return false;
  };
}
