import { Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Euler, Vector3, BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DonneesCarte } from '../cartes/types';
import { BORNES, hauteurTerrain } from './terrain';
import { creerSurRoute, dansPoly } from './geom';
import type { Obstacles } from './collision';

/** Forêts réelles (BD TOPO) : arbres 3D instanciés par carrés de 120 m autour du joueur ; au loin, le sol est peint en forêt. */
const TAILLE = 120;
const PAS = 8;
const FEUILLAGE_MOIS = ['#7d6e55', '#7d6e55', '#8a7a55', '#8fae56', '#6f9a3c', '#5a8330', '#557d2e', '#557d2e', '#62802c', '#b9852e', '#98592c', '#7d6e55'];
const hasard = (n: number): number => { let h = (n * 2654435761) | 0; h = Math.imul(h ^ (h >>> 15), 2246822519); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

function coul(geo: BufferGeometry, hex: string): BufferGeometry {
  const c = new Color(hex); const n = geo.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new Float32BufferAttribute(a, 3));
  return geo;
}

export interface Arbres { groupe: Group; mettreAJour: (x: number, z: number) => void; saison: (mois: number) => void }

export function construireArbres(d: DonneesCarte, obst: Obstacles): Arbres {
  const groupe = new Group();
  const polys: { t: string; pts: Float32Array; minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  for (const v of d.vegetation) {
    if (!['b', 'f', 'm', 'k', 'p'].includes(v.t)) continue;
    const pts = new Float32Array(v.p);
    let minX = 1e9; let maxX = -1e9; let minZ = 1e9; let maxZ = -1e9;
    for (let k = 0; k < pts.length; k += 2) { minX = Math.min(minX, pts[k]); maxX = Math.max(maxX, pts[k]); minZ = Math.min(minZ, pts[k + 1]); maxZ = Math.max(maxZ, pts[k + 1]); }
    polys.push({ t: v.t, pts, minX, maxX, minZ, maxZ });
  }
  const surRoute = creerSurRoute(d);
  // conifère = tronc + cône ; feuillu = tronc + houppier (couleurs de sommet, teintées ensuite par instance)
  const tc = coul(new CylinderGeometry(0.25, 0.35, 2, 5).toNonIndexed(), '#4a3a2a'); tc.translate(0, 1, 0);
  const co = coul(new ConeGeometry(2.1, 7, 6).toNonIndexed(), '#3f6a3a'); co.translate(0, 5.2, 0);
  const geoConifere = mergeGeometries([tc, co]);
  const tf = coul(new CylinderGeometry(0.25, 0.4, 3.6, 5).toNonIndexed(), '#5a4a3a'); tf.translate(0, 1.8, 0);
  const ho = coul(new IcosahedronGeometry(2.8, 1).toNonIndexed(), '#ffffff'); ho.translate(0, 5.6, 0);
  const geoFeuillu = mergeGeometries([tf, ho]);
  const matC = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const matF = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  let mois = 0;
  interface Carre { i: number; j: number; groupe: Group; feuillus?: InstancedMesh; positions: number[] }
  const carres = new Map<number, Carre>();
  const m4 = new Matrix4(); const q = new Quaternion(); const e = new Euler(); const pos = new Vector3(); const sc = new Vector3(); const col = new Color();

  const teinter = (c: Carre): void => {
    if (!c.feuillus) return;
    const n = c.positions.length / 4;
    for (let k = 0; k < n; k++) {
      col.set(FEUILLAGE_MOIS[mois]); const a = c.positions[k * 4 + 3];
      col.offsetHSL((a - 0.5) * 0.06, 0, (a - 0.5) * 0.12);
      c.feuillus.setColorAt(k, col);
    }
    if (c.feuillus.instanceColor) c.feuillus.instanceColor.needsUpdate = true;
  };

  function construire(i: number, j: number): Carre {
    const x0 = BORNES.minX + i * TAILLE; const z0 = BORNES.minZ + j * TAILLE;
    const proches = polys.filter((p) => p.maxX > x0 && p.minX < x0 + TAILLE && p.maxZ > z0 && p.minZ < z0 + TAILLE);
    const con: number[] = []; const feu: number[] = [];
    if (proches.length) {
      for (let gx = 0; gx < TAILLE / PAS; gx++) for (let gz = 0; gz < TAILLE / PAS; gz++) {
        const sid = i * 7919 + j * 104729 + gx * 31 + gz * 17;
        const x = x0 + (gx + 0.2 + 0.6 * hasard(sid)) * PAS; const z = z0 + (gz + 0.2 + 0.6 * hasard(sid + 1)) * PAS;
        const p = proches.find((q2) => x > q2.minX && x < q2.maxX && z > q2.minZ && z < q2.maxZ && dansPoly(x, z, q2.pts));
        if (!p || surRoute(x, z) || obst.dansBatiment(x, z, 2)) continue;
        const r = hasard(sid + 2);
        const conifere = p.t === 'k' ? r < 0.9 : p.t === 'm' ? r < 0.5 : r < 0.2;
        (conifere ? con : feu).push(x, z, 0.8 + hasard(sid + 3) * 0.7, hasard(sid + 4));
      }
    }
    const g = new Group();
    const c: Carre = { i, j, groupe: g, positions: feu };
    const faire = (liste: number[], geo: BufferGeometry, mat: MeshStandardMaterial, teinte: boolean): InstancedMesh | undefined => {
      const n = liste.length / 4; if (!n) return undefined;
      const im = new InstancedMesh(geo, mat, n);
      for (let k = 0; k < n; k++) {
        const x = liste[k * 4]; const z = liste[k * 4 + 1]; const s = liste[k * 4 + 2];
        im.setMatrixAt(k, m4.compose(pos.set(x, hauteurTerrain(x, z) - 0.2, z), q.setFromEuler(e.set(0, hasard(k + x) * 6, 0)), sc.set(s, s * (0.9 + 0.3 * liste[k * 4 + 3]), s)));
        if (!teinte) { col.set('#ffffff').offsetHSL((liste[k * 4 + 3] - 0.5) * 0.05, 0, (liste[k * 4 + 3] - 0.5) * 0.14); im.setColorAt(k, col); }
      }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere();
      g.add(im);
      return im;
    };
    faire(con, geoConifere, matC, false);
    c.feuillus = faire(feu, geoFeuillu, matF, true);
    teinter(c);
    return c;
  }

  return {
    groupe,
    saison: (m) => { mois = m; for (const c of carres.values()) teinter(c); },
    mettreAJour: (px, pz) => {
      const ci = Math.floor((px - BORNES.minX) / TAILLE); const cj = Math.floor((pz - BORNES.minZ) / TAILLE);
      let voulu: [number, number] | null = null; let dMin = 1e9;
      for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
        if (carres.has(i * 10000 + j)) continue;
        const dd = Math.hypot(BORNES.minX + (i + 0.5) * TAILLE - px, BORNES.minZ + (j + 0.5) * TAILLE - pz);
        if (dd < 260 && dd < dMin) { dMin = dd; voulu = [i, j]; }
      }
      if (voulu) { const c = construire(voulu[0], voulu[1]); carres.set(voulu[0] * 10000 + voulu[1], c); groupe.add(c.groupe); }
      for (const [k, c] of carres) {
        if (Math.hypot(BORNES.minX + (c.i + 0.5) * TAILLE - px, BORNES.minZ + (c.j + 0.5) * TAILLE - pz) > 420) {
          groupe.remove(c.groupe); c.groupe.traverse((o) => { if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).dispose(); }); carres.delete(k);
        }
      }
    },
  };
}
