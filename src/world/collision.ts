import type { DonneesCarte } from '../cartes/types';
import { LIEUX } from './lieux';

/** Obstacles réels : contours des bâtiments et de l'eau (le joueur ne les traverse pas), plus quelques obstacles ronds. */
interface Poly { pts: Float32Array; minX: number; maxX: number; minZ: number; maxZ: number; marge: number }

const CELL = 40;

export class Obstacles {
  private readonly polys: Poly[] = [];
  private readonly grille = new Map<number, number[]>();
  private readonly ronds: { x: number; z: number; r: number }[] = [];

  constructor(d: DonneesCarte) {
    const ajouter = (p: number[], marge: number): void => {
      const pts = new Float32Array(p);
      let minX = 1e9; let maxX = -1e9; let minZ = 1e9; let maxZ = -1e9;
      for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minZ = Math.min(minZ, pts[i + 1]); maxZ = Math.max(maxZ, pts[i + 1]); }
      const id = this.polys.length;
      this.polys.push({ pts, minX, maxX, minZ, maxZ, marge });
      for (let cx = Math.floor((minX - marge) / CELL); cx <= Math.floor((maxX + marge) / CELL); cx++) {
        for (let cz = Math.floor((minZ - marge) / CELL); cz <= Math.floor((maxZ + marge) / CELL); cz++) {
          const k = cx * 100000 + cz;
          const l = this.grille.get(k); if (l) l.push(id); else this.grille.set(k, [id]);
        }
      }
    };
    for (const b of d.batiments) ajouter(b.p, 0.5);
    for (const e of d.eau) if (e.nat === 'Ecoulement naturel' || e.nat === 'Canal') ajouter(e.p, 1.5);
    for (const l of LIEUX) if (l.collision > 0) this.ronds.push({ x: l.x, z: l.z, r: l.collision });
  }

  private static dedans(x: number, z: number, p: Float32Array): boolean {
    let d = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) d = !d;
    }
    return d;
  }

  /** Vrai si le point est dans un bâtiment (ou à moins de `marge` mètres). */
  dansBatiment(x: number, z: number, marge = 0): boolean {
    const l = this.grille.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL));
    if (!l) return false;
    for (const id of l) {
      const p = this.polys[id];
      if (x < p.minX - marge || x > p.maxX + marge || z < p.minZ - marge || z > p.maxZ + marge) continue;
      if (Obstacles.dedans(x, z, p.pts)) return true;
      if (marge > 0 && this.distBord(x, z, p.pts).d < marge) return true;
    }
    return false;
  }

  private distBord(x: number, z: number, p: Float32Array): { d: number; bx: number; bz: number } {
    let d = 1e9; let bx = x; let bz = z;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const ax = p[j]; const az = p[j + 1]; const dx = p[i] - ax; const dz = p[i + 1] - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-9)));
      const px = ax + t * dx; const pz = az + t * dz;
      const dd = Math.hypot(x - px, z - pz);
      if (dd < d) { d = dd; bx = px; bz = pz; }
    }
    return { d, bx, bz };
  }

  /** Repousse un point hors des obstacles. */
  resoudre(pos: { x: number; z: number }, rayon = 0.45): void {
    const l = this.grille.get(Math.floor(pos.x / CELL) * 100000 + Math.floor(pos.z / CELL));
    if (l) {
      for (const id of l) {
        const p = this.polys[id];
        const r = rayon + p.marge * 0.5;
        if (pos.x < p.minX - r || pos.x > p.maxX + r || pos.z < p.minZ - r || pos.z > p.maxZ + r) continue;
        const dedans = Obstacles.dedans(pos.x, pos.z, p.pts);
        const { d, bx, bz } = this.distBord(pos.x, pos.z, p.pts);
        if (!dedans && d >= r) continue;
        let nx = dedans ? bx - pos.x : pos.x - bx; let nz = dedans ? bz - pos.z : pos.z - bz;
        const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
        pos.x = bx + nx * r; pos.z = bz + nz * r;
      }
    }
    for (const o of this.ronds) {
      const dx = pos.x - o.x; const dz = pos.z - o.z; const d = Math.hypot(dx, dz); const min = o.r + rayon;
      if (d < min && d > 1e-4) { pos.x = o.x + (dx / d) * min; pos.z = o.z + (dz / d) * min; }
    }
  }
}
