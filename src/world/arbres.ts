import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, Group, InstancedMesh, Matrix4,
  MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DonneesCarte } from '../cartes/types';
import { BORNES, hauteurTerrain } from './terrain';
import { creerSurRoute, dansPoly } from './geom';
import type { Obstacles } from './collision';
import type { Matieres } from './matieres';
import { textureAiguilles, texturePousse } from './textures';

/**
 * Forêts réelles (BD TOPO). Arbres 3D instanciés par carrés de 120 m autour du joueur :
 * tronc avec écorce photo (ambientCG), branches, et feuillage en cartes de rameaux nervurés (feuillus) ou
 * en branches d'aiguilles (résineux). Au loin, le sol est peint en forêt.
 */
const TAILLE = 120;
const PAS = 9;
const FEUILLAGE_MOIS = ['#7d6e55', '#7d6e55', '#8a7a55', '#9dbd5a', '#6f9a3c', '#5a8a30', '#557d2e', '#557d2e', '#62802c', '#c08a2e', '#9c5a2c', '#7d6e55'];
const ECHELLE_MOIS = [0.001, 0.001, 0.3, 0.8, 1, 1, 1, 1, 1, 0.95, 0.5, 0.001];
const hasard = (n: number): number => { let h = (n * 2654435761) | 0; h = Math.imul(h ^ (h >>> 15), 2246822519); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

function alea(graine: number): () => number {
  let s = graine | 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Tronc effilé orienté d'un point à un autre. */
function branche(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number): BufferGeometry {
  const a = new Vector3(x0, y0, z0); const b = new Vector3(x1, y1, z1);
  const L = a.distanceTo(b);
  const g = new CylinderGeometry(r1, r0, L, 7, 1, true);
  g.translate(0, L / 2, 0);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q); g.translate(x0, y0, z0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i) * L * 0.6);
  return g.toNonIndexed();
}

function carte(w: number, h: number, x: number, y: number, z: number, ry: number, rx: number, rz: number, teinte: number): BufferGeometry {
  const g = new PlaneGeometry(w, h);
  g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz)));
  g.translate(x, y, z);
  const n = g.attributes.position.count; const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = teinte; c[i * 3 + 1] = teinte; c[i * 3 + 2] = teinte; }
  g.setAttribute('color', new Float32BufferAttribute(c, 3));
  return g.toNonIndexed();
}

/** Les normales du feuillage pointent vers l'extérieur du houppier : l'ombrage est doux, sans facettes plates. */
function normalesRadiales(g: BufferGeometry, cx: number, cy: number, cz: number, haut: number): void {
  const p = g.attributes.position; const n = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = new Vector3(p.getX(i) - cx, p.getY(i) - cy, p.getZ(i) - cz).normalize();
    v.y += haut; v.normalize();
    n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z;
  }
  g.setAttribute('normal', new Float32BufferAttribute(n, 3));
}

function arbreFeuillu(): { bois: BufferGeometry; feuillage: BufferGeometry } {
  const r = alea(5); const bois: BufferGeometry[] = []; const f: BufferGeometry[] = [];
  bois.push(branche(0, -0.3, 0, 0.1, 4.2, 0, 0.42, 0.22));
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + r(); const y0 = 3 + r() * 2.5; const up = 0.9 + r() * 0.8; const out = 1.8 + r() * 1.8;
    const x1 = Math.cos(a) * out; const z1 = Math.sin(a) * out; const y1 = y0 + up + 1.2;
    bois.push(branche(0.1, y0, 0, x1, y1, z1, 0.15, 0.05));
    // rameaux secondaires au bout de chaque branche
    for (let s = 0; s < 2; s++) { const a2 = a + (s ? 0.7 : -0.7); bois.push(branche(x1, y1, z1, x1 + Math.cos(a2) * 1.3, y1 + 1.0, z1 + Math.sin(a2) * 1.3, 0.05, 0.02)); }
  }
  for (let k = 0; k < 26; k++) { // cartes de feuillage dans un ellipsoïde
    const u = r() * Math.PI * 2; const v = Math.acos(2 * r() - 1); const rad = 0.35 + 0.65 * Math.cbrt(r());
    const x = Math.sin(v) * Math.cos(u) * 3.8 * rad; const z = Math.sin(v) * Math.sin(u) * 3.8 * rad; const y = 7.2 + Math.cos(v) * 3 * rad;
    f.push(carte(4.4, 4.4, x, y, z, r() * Math.PI, (r() - 0.5) * 1.3, (r() - 0.5) * 1.3, 0.75 + 0.25 * rad));
  }
  const fg = mergeGeometries(f); normalesRadiales(fg, 0, 7, 0, 0.35);
  return { bois: mergeGeometries(bois), feuillage: fg };
}

function arbreConifere(): { bois: BufferGeometry; feuillage: BufferGeometry } {
  const r = alea(9); const f: BufferGeometry[] = [];
  const bois = branche(0, -0.3, 0, 0.05, 15, 0, 0.36, 0.05);
  const etages = 11;
  for (let t = 0; t < etages; t++) {
    const k = t / (etages - 1); const y = 2.2 + k * 11.5; const L = (1 - k * 0.82) * 4.6 + 0.6;
    const n = 6;
    for (let a = 0; a < n; a++) {
      const ang = (a / n) * Math.PI * 2 + t * 0.9 + r() * 0.4;
      const g = new PlaneGeometry(L * 0.55, L);
      g.translate(0, L / 2, 0); // la base de la carte part du tronc
      g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(1.28 + r() * 0.15, 0, 0))); // quasi à plat, légèrement retombant
      g.applyMatrix4(new Matrix4().makeRotationY(ang));
      g.translate(0, y, 0);
      const c = new Float32Array(g.attributes.position.count * 3).fill(0.7 + 0.3 * r());
      g.setAttribute('color', new Float32BufferAttribute(c, 3));
      f.push(g.toNonIndexed());
    }
  }
  const fg = mergeGeometries(f); normalesRadiales(fg, 0, 7, 0, 0.6);
  return { bois, feuillage: fg };
}

export interface Arbres { groupe: Group; mettreAJour: (x: number, z: number) => void; saison: (mois: number) => void; nombre: () => number }

export function construireArbres(d: DonneesCarte, obst: Obstacles, m: Matieres): Arbres {
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
  const fe = arbreFeuillu(); const co = arbreConifere();
  const ecorce = m.ecorce.couleur.clone(); ecorce.needsUpdate = true;
  const ecorceN = m.ecorce.relief.clone(); ecorceN.needsUpdate = true;
  const matBois = new MeshStandardMaterial({ map: ecorce, normalMap: ecorceN, color: '#cbb9a6', roughness: 0.95, side: DoubleSide });
  const matFeu = new MeshStandardMaterial({ map: texturePousse(), vertexColors: true, alphaTest: 0.5, side: DoubleSide, roughness: 0.8 });
  const matCon = new MeshStandardMaterial({ map: textureAiguilles(), vertexColors: true, alphaTest: 0.5, side: DoubleSide, roughness: 0.8, color: '#7fa072' });
  let mois = 0;
  interface Carre { i: number; j: number; groupe: Group; feuillus?: InstancedMesh; pos: number[]; tot: number }
  const carres = new Map<number, Carre>();
  const m4 = new Matrix4(); const q = new Quaternion(); const e = new Euler(); const pos = new Vector3(); const sc = new Vector3(); const col = new Color();
  let total = 0;

  const saisonner = (c: Carre): void => {
    if (!c.feuillus) return;
    const n = c.pos.length / 4;
    for (let k = 0; k < n; k++) {
      const x = c.pos[k * 4]; const z = c.pos[k * 4 + 1]; const s = c.pos[k * 4 + 2]; const a = c.pos[k * 4 + 3];
      const ech = Math.max(0.001, ECHELLE_MOIS[mois] * s);
      c.feuillus.setMatrixAt(k, m4.compose(pos.set(x, hauteurTerrain(x, z) - 0.2, z), q.setFromEuler(e.set(0, a * 6.28, 0)), sc.set(ech * (0.9 + 0.2 * a), ech * (mois === 0 || mois === 11 || mois === 1 ? 0.001 : 1), ech * (0.9 + 0.2 * a))));
      col.set(FEUILLAGE_MOIS[mois]).offsetHSL((a - 0.5) * 0.06, 0, (a - 0.5) * 0.14);
      c.feuillus.setColorAt(k, col);
    }
    c.feuillus.instanceMatrix.needsUpdate = true; if (c.feuillus.instanceColor) c.feuillus.instanceColor.needsUpdate = true;
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
        if (!p || surRoute(x, z) || obst.dansBatiment(x, z, 3)) continue;
        const r = hasard(sid + 2);
        const conifere = p.t === 'k' ? r < 0.9 : p.t === 'm' ? r < 0.5 : r < 0.15;
        (conifere ? con : feu).push(x, z, 0.8 + hasard(sid + 3) * 0.55, hasard(sid + 4));
      }
    }
    const g = new Group();
    const c: Carre = { i, j, groupe: g, pos: feu, tot: con.length / 4 + feu.length / 4 };
    total += c.tot;
    const mk = (liste: number[], geo: BufferGeometry, mat: MeshStandardMaterial, teinte: boolean): InstancedMesh | undefined => {
      const n = liste.length / 4; if (!n) return undefined;
      const im = new InstancedMesh(geo, mat, n);
      for (let k = 0; k < n; k++) {
        const x = liste[k * 4]; const z = liste[k * 4 + 1]; const s = liste[k * 4 + 2]; const a = liste[k * 4 + 3];
        im.setMatrixAt(k, m4.compose(pos.set(x, hauteurTerrain(x, z) - 0.2, z), q.setFromEuler(e.set(0, a * 6.28, 0)), sc.set(s, s * (0.9 + 0.3 * a), s)));
        if (teinte) { col.set('#ffffff').offsetHSL((a - 0.5) * 0.04, 0, (a - 0.5) * 0.18); im.setColorAt(k, col); }
      }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere();
      g.add(im);
      return im;
    };
    mk(con, co.bois, matBois, false); mk(con, co.feuillage, matCon, true);
    mk(feu, fe.bois, matBois, false);
    c.feuillus = mk(feu, fe.feuillage, matFeu, false);
    saisonner(c);
    return c;
  }

  return {
    groupe,
    nombre: () => total,
    saison: (mm) => { mois = mm; for (const c of carres.values()) saisonner(c); },
    mettreAJour: (px, pz) => {
      const ci = Math.floor((px - BORNES.minX) / TAILLE); const cj = Math.floor((pz - BORNES.minZ) / TAILLE);
      let voulu: [number, number] | null = null; let dMin = 1e9;
      for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
        if (carres.has(i * 10000 + j)) continue;
        const dd = Math.hypot(BORNES.minX + (i + 0.5) * TAILLE - px, BORNES.minZ + (j + 0.5) * TAILLE - pz);
        if (dd < 230 && dd < dMin) { dMin = dd; voulu = [i, j]; }
      }
      if (voulu) { const c = construire(voulu[0], voulu[1]); carres.set(voulu[0] * 10000 + voulu[1], c); groupe.add(c.groupe); }
      for (const [k, c] of carres) {
        if (Math.hypot(BORNES.minX + (c.i + 0.5) * TAILLE - px, BORNES.minZ + (c.j + 0.5) * TAILLE - pz) > 380) {
          groupe.remove(c.groupe); total -= c.tot; c.groupe.traverse((o) => { if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).dispose(); }); carres.delete(k);
        }
      }
    },
  };
}
