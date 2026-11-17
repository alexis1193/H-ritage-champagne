import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Euler, Group, InstancedMesh, Matrix4,
  MeshStandardMaterial, PlaneGeometry, Quaternion, RepeatWrapping, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DonneesCarte } from '../cartes/types';
import { BORNES, hauteurTerrain } from './terrain';
import { PARCELLES } from './lieux';
import { textureFeuilles } from './textures';
import { angleDeNiveau, CELLULE, celluleDe, ESPACEMENT_PIEDS, ESPACEMENT_RANGS, niveauAngle } from './rangs';
import type { Obstacles } from './collision';
import { creerSurRoute, dansPoly } from './geom';

/**
 * Vignes détaillées, chargées par carrés de 60 m autour du joueur :
 * - près (< 100 m) : chaque pied (tronc, bras, rameaux, feuilles, grappes) + piquets et fils de palissage ;
 * - moyen (100 à 240 m) : haies de feuillage en segments ;
 * - loin : les rangs sont dessinés dans le sol (voir sol.ts).
 * L'aspect suit le mois (0 = janvier … 11 = décembre).
 */

const FEUILLES = [0, 0, 0.04, 0.4, 0.75, 1, 1, 1, 1, 0.9, 0.35, 0];
const RAMEAUX = [0.14, 0.14, 0.16, 0.45, 0.85, 1, 1, 1, 1, 1, 0.9, 0.2];
const GRAPPES = [0, 0, 0, 0, 0, 0.3, 0.55, 0.8, 1, 0, 0, 0];
const COUL_FEUILLES = ['#8a7a4a', '#8a7a4a', '#a9c46a', '#a3cc55', '#7fb43c', '#5a9a30', '#4f8c2f', '#4f8c2f', '#5f8f2a', '#c9a030', '#a8622a', '#8a7a4a'];
const COUL_RAMEAUX = ['#6b5238', '#6b5238', '#7a6a3a', '#9cc24a', '#7fb43c', '#6aa233', '#5a9a30', '#5a9a30', '#6a8a3a', '#8a6a3a', '#7a5a3a', '#6b5238'];
const BLANC = [new Color('#9dbb58'), new Color('#aebf5a'), new Color('#c8c25a'), new Color('#d8c768')];
const NOIR = [new Color('#8fb050'), new Color('#7f6a8a'), new Color('#4a3558'), new Color('#2a1a3a')];
const ROUGE = new Color('#a5442a');
const etapeGrappe = (mois: number): number => (mois <= 6 ? 0 : mois === 7 ? 1 : 3);

const hasard = (n: number): number => { let h = (n * 2654435761) | 0; h = Math.imul(h ^ (h >>> 15), 2246822519); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

interface Run { t: number; s0: number; s1: number }
interface Chunk {
  i: number; j: number; etat: 'proche' | 'moyen';
  groupe: Group; pieds: Float32Array; // x, z, rot, aleatoire, cepage
  runs: Run[]; th: number;
  meshes: { troncs?: InstancedMesh; rameaux?: InstancedMesh; feuilles?: InstancedMesh; grappes?: InstancedMesh; haies?: InstancedMesh };
}

export interface GestionVignes {
  groupe: Group;
  mettreAJour: (x: number, z: number) => void;
  saison: (mois: number) => void;
  stats: () => { proches: number; moyens: number };
  /** Empêche de piétiner la vigne : dans un rang, on ne circule que dans l'inter-rang. */
  contraindre: (ox: number, oz: number, p: { x: number; z: number }) => void;
}

export function construireVignes(d: DonneesCarte, obst: Obstacles): GestionVignes {
  const groupe = new Group();
  // --- polygones de vigne et index par carré
  const polys: { pts: Float32Array; minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  const parCase = new Map<number, number[]>();
  const cle = (i: number, j: number): number => i * 10000 + j;
  for (const v of d.vegetation) {
    if (v.t !== 'v') continue;
    const pts = new Float32Array(v.p);
    let minX = 1e9; let maxX = -1e9; let minZ = 1e9; let maxZ = -1e9;
    for (let k = 0; k < pts.length; k += 2) { minX = Math.min(minX, pts[k]); maxX = Math.max(maxX, pts[k]); minZ = Math.min(minZ, pts[k + 1]); maxZ = Math.max(maxZ, pts[k + 1]); }
    const id = polys.length;
    polys.push({ pts, minX, maxX, minZ, maxZ });
    const [i0, j0] = celluleDe(minX, minZ); const [i1, j1] = celluleDe(maxX, maxZ);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = parCase.get(cle(i, j)); if (l) l.push(id); else parCase.set(cle(i, j), [id]); }
  }
  const surRoute = creerSurRoute(d);
  const parcellesCep = Object.values(PARCELLES).map((p) => ({ pts: new Float32Array(p.coins.flat()), c: p.cepage === 'chardonnay' ? 0 : p.cepage === 'pinot noir' ? 1 : 2 }));

  // --- géométries et matériaux partagés
  const geoTronc = new CylinderGeometry(0.03, 0.05, 0.66, 5); geoTronc.translate(0, 0.33, 0);
  const geoBras = new CylinderGeometry(0.02, 0.026, 1.0, 5); geoBras.rotateZ(Math.PI / 2); geoBras.translate(0, 0.66, 0);
  const geoPied = mergeGeometries([geoTronc.toNonIndexed(), geoBras.toNonIndexed()]);
  const rams: BufferGeometry[] = [];
  for (const [dx, l] of [[-0.28, 0], [0, 0.1], [0.28, -0.1]] as const) { const r = new CylinderGeometry(0.006, 0.012, 1, 4); r.translate(0, 0.5, 0); r.rotateZ(l * 0.5); r.translate(dx, 0.66, 0); rams.push(r.toNonIndexed()); }
  const geoRameaux = mergeGeometries(rams);
  const geoGrappe = new ConeGeometry(0.07, 0.22, 6); geoGrappe.rotateX(Math.PI); geoGrappe.translate(0, -0.11, 0);
  const plans: BufferGeometry[] = [];
  for (const a of [0, 0.9, -0.9]) { const p = new PlaneGeometry(1.1, 0.95); p.rotateY(a); plans.push(p); }
  const geoFeuilles = mergeGeometries(plans);
  const haie: BufferGeometry[] = [];
  for (const a of [0.35, -0.35]) { const p = new PlaneGeometry(1, 1.15); p.rotateX(a); p.translate(0, 1.0, 0); haie.push(p); }
  const geoHaie = mergeGeometries(haie);
  const geoPoteau = new BoxGeometry(0.07, 1.75, 0.07); geoPoteau.translate(0, 0.875, 0);
  const geoFil = new BoxGeometry(1, 0.012, 0.012);

  const feuilleTex = textureFeuilles();
  const feuilleLong = feuilleTex.clone(); feuilleLong.needsUpdate = true; feuilleLong.repeat.set(5, 1); feuilleLong.wrapS = feuilleLong.wrapT = RepeatWrapping;
  const bois = new MeshStandardMaterial({ color: '#6e5a40', roughness: 0.95 });
  const matRameau = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const matFeuilles = new MeshStandardMaterial({ map: feuilleTex, alphaTest: 0.5, side: DoubleSide, roughness: 0.75 });
  const matHaie = new MeshStandardMaterial({ map: feuilleLong, alphaTest: 0.5, side: DoubleSide, roughness: 0.75 });
  const matGrappe = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const matPoteau = new MeshStandardMaterial({ color: '#8d7c5e', roughness: 0.9 });
  const matFil = new MeshStandardMaterial({ color: '#b6babd', roughness: 0.4, metalness: 0.7 });

  let mois = 0;
  const chunks = new Map<number, Chunk>();
  const m4 = new Matrix4(); const q = new Quaternion(); const e = new Euler(); const pos = new Vector3(); const sc = new Vector3(); const un = new Vector3(1, 1, 1);
  const cF = new Color(); const cG = new Color();

  function generer(i: number, j: number): { pieds: number[]; runs: Run[]; th: number } {
    const ids = parCase.get(cle(i, j)) ?? [];
    const x0 = BORNES.minX + i * CELLULE; const z0 = BORNES.minZ + j * CELLULE; const x1 = x0 + CELLULE; const z1 = z0 + CELLULE;
    const th = angleDeNiveau(niveauAngle(i, j));
    const dx = Math.cos(th); const dz = Math.sin(th); const nx = -dz; const nz = dx;
    const ts = [x0 * nx + z0 * nz, x1 * nx + z0 * nz, x0 * nx + z1 * nz, x1 * nx + z1 * nz];
    const ss = [x0 * dx + z0 * dz, x1 * dx + z0 * dz, x0 * dx + z1 * dz, x1 * dx + z1 * dz];
    const pieds: number[] = []; const runs: Run[] = [];
    for (let m = Math.floor(Math.min(...ts) / ESPACEMENT_RANGS); m <= Math.ceil(Math.max(...ts) / ESPACEMENT_RANGS); m++) {
      const t = (m + 0.5) * ESPACEMENT_RANGS;
      let run: Run | null = null; let dernier = -1e9;
      for (let s = Math.ceil(Math.min(...ss)); s <= Math.max(...ss); s += ESPACEMENT_PIEDS) {
        const x = t * nx + s * dx; const z = t * nz + s * dz;
        if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
        let ok = false; let pid = -1;
        for (const id of ids) { const p = polys[id]; if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ && dansPoly(x, z, p.pts)) { ok = true; pid = id; break; } }
        if (ok && (surRoute(x, z) || obst.dansBatiment(x, z, 1.8))) ok = false;
        if (!ok) { run = null; continue; }
        let cep = Math.floor(hasard(pid + 1) * 3);
        for (const pc of parcellesCep) if (dansPoly(x, z, pc.pts)) { cep = pc.c; break; }
        pieds.push(x, z, (hasard(Math.floor(x * 7 + z * 13)) - 0.5) * 0.5, hasard(Math.floor(x * 31 + z * 17)), cep);
        if (!run || s - dernier > 1.5) { run = { t, s0: s, s1: s }; runs.push(run); }
        run.s1 = s; dernier = s;
      }
    }
    return { pieds, runs, th };
  }

  function appliquer(c: Chunk): void {
    const f = FEUILLES[mois]; const ra = RAMEAUX[mois]; const gr = GRAPPES[mois]; const etape = etapeGrappe(mois);
    const n = c.pieds.length / 5;
    const { feuilles, rameaux, grappes, haies } = c.meshes;
    if (feuilles && rameaux && grappes) {
      for (let k = 0; k < n; k++) {
        const x = c.pieds[k * 5]; const z = c.pieds[k * 5 + 1]; const rot = c.pieds[k * 5 + 2]; const au = c.pieds[k * 5 + 3]; const cep = c.pieds[k * 5 + 4];
        const y = hauteurTerrain(x, z);
        const g = Math.max(0.0001, f * (0.9 + 0.2 * au));
        cF.set(COUL_FEUILLES[mois]);
        if (mois === 9 && cep !== 0) cF.lerp(ROUGE, 0.5);
        cF.offsetHSL((au - 0.5) * 0.05, 0, (au - 0.5) * 0.12);
        feuilles.setMatrixAt(k, m4.compose(pos.set(x, y + 0.78 + 0.45 * g, z), q.setFromEuler(e.set(0, rot + c.th, 0)), sc.set(g * 1.05, g, g)));
        feuilles.setColorAt(k, cF);
        const len = Math.max(0.0001, ra * (0.8 + 0.4 * au));
        rameaux.setMatrixAt(k, m4.compose(pos.set(x, y, z), q.setFromEuler(e.set(0, c.th, 0)), sc.set(1, len * 0.9, 1)));
        cG.set(COUL_RAMEAUX[mois]).offsetHSL(0, 0, (au - 0.5) * 0.06);
        rameaux.setColorAt(k, cG);
        const gs = Math.max(0.0001, gr * (0.7 + 0.6 * au));
        grappes.setMatrixAt(k, m4.compose(pos.set(x, y + 0.66, z), q.setFromEuler(e.set(0, c.th, 0)), sc.set(gs, gs, gs)));
        grappes.setColorAt(k, (cep === 0 ? BLANC : NOIR)[etape]);
      }
      for (const m of [feuilles, rameaux, grappes]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    if (haies) { // haies : couleur et hauteur selon la saison
      const g = Math.max(0.0001, f);
      cF.set(COUL_FEUILLES[mois]);
      const nb = haies.count;
      for (let k = 0; k < nb; k++) {
        haies.getMatrixAt(k, m4);
        m4.decompose(pos, q, sc);
        sc.y = g;
        haies.setMatrixAt(k, m4.compose(pos, q, sc));
        haies.setColorAt(k, cF);
      }
      haies.instanceMatrix.needsUpdate = true; if (haies.instanceColor) haies.instanceColor.needsUpdate = true;
    }
  }

  function construireProche(i: number, j: number): Chunk | null {
    const { pieds, runs, th } = generer(i, j);
    if (!pieds.length) return null;
    const n = pieds.length / 5;
    const g = new Group();
    const troncs = new InstancedMesh(geoPied, bois, n);
    const rameaux = new InstancedMesh(geoRameaux, matRameau, n);
    const feuilles = new InstancedMesh(geoFeuilles, matFeuilles, n);
    const grappes = new InstancedMesh(geoGrappe, matGrappe, n);
    for (let k = 0; k < n; k++) {
      const x = pieds[k * 5]; const z = pieds[k * 5 + 1]; const rot = pieds[k * 5 + 2];
      troncs.setMatrixAt(k, m4.compose(pos.set(x, hauteurTerrain(x, z), z), q.setFromEuler(e.set(0, th + rot * 0.2, 0)), un));
    }
    // piquets (tous les 5 m) et fils (3 hauteurs) par tronçon de rang
    const postes: number[] = [];
    for (const r of runs) {
      postes.push(r.s0, r.t);
      for (let s = Math.ceil(r.s0 / 5) * 5; s < r.s1; s += 5) if (s > r.s0 + 1) postes.push(s, r.t);
      postes.push(r.s1, r.t);
    }
    const piquets = new InstancedMesh(geoPoteau, matPoteau, postes.length / 2);
    const dx = Math.cos(th); const dz = Math.sin(th); const nx = -dz; const nz = dx;
    for (let k = 0; k < postes.length / 2; k++) {
      const s = postes[k * 2]; const t = postes[k * 2 + 1]; const x = t * nx + s * dx; const z = t * nz + s * dz;
      piquets.setMatrixAt(k, m4.compose(pos.set(x, hauteurTerrain(x, z), z), q.identity(), un));
    }
    const fils = new InstancedMesh(geoFil, matFil, runs.length * 3);
    runs.forEach((r, k) => {
      const sm = (r.s0 + r.s1) / 2; const x = r.t * nx + sm * dx; const z = r.t * nz + sm * dz;
      [0.66, 1.08, 1.45].forEach((h, a) => fils.setMatrixAt(k * 3 + a, m4.compose(pos.set(x, hauteurTerrain(x, z) + h, z), q.setFromEuler(e.set(0, -th, 0)), sc.set(r.s1 - r.s0 + 0.6, 1, 1))));
    });
    troncs.instanceMatrix.needsUpdate = piquets.instanceMatrix.needsUpdate = fils.instanceMatrix.needsUpdate = true;
    for (const m of [troncs, rameaux, feuilles, grappes, piquets, fils]) { m.castShadow = false; m.receiveShadow = false; g.add(m); }
    const chunk: Chunk = { i, j, etat: 'proche', groupe: g, pieds: Float32Array.from(pieds), runs, th, meshes: { troncs, rameaux, feuilles, grappes } };
    appliquer(chunk);
    for (const m of [troncs, rameaux, feuilles, grappes, piquets, fils]) { m.computeBoundingSphere(); }
    return chunk;
  }

  function construireMoyen(i: number, j: number): Chunk | null {
    const { runs, th } = generer(i, j);
    if (!runs.length) return null;
    const dx = Math.cos(th); const dz = Math.sin(th); const nx = -dz; const nz = dx;
    const segments: [number, number, number][] = []; // x, z, longueur
    for (const r of runs) {
      for (let s = r.s0; s < r.s1; s += 6) {
        const e1 = Math.min(r.s1, s + 6); const sm = (s + e1) / 2;
        segments.push([r.t * nx + sm * dx, r.t * nz + sm * dz, e1 - s + 1]);
      }
    }
    const haies = new InstancedMesh(geoHaie, matHaie, segments.length);
    segments.forEach(([x, z, l], k) => haies.setMatrixAt(k, m4.compose(pos.set(x, hauteurTerrain(x, z) + 0.05, z), q.setFromEuler(e.set(0, -th, 0)), sc.set(l, 1, 1))));
    haies.instanceMatrix.needsUpdate = true;
    haies.castShadow = false; haies.receiveShadow = false;
    const g = new Group(); g.add(haies);
    const chunk: Chunk = { i, j, etat: 'moyen', groupe: g, pieds: new Float32Array(0), runs, th, meshes: { haies } };
    appliquer(chunk);
    haies.computeBoundingSphere();
    return chunk;
  }

  const liberer = (c: Chunk): void => {
    groupe.remove(c.groupe);
    c.groupe.traverse((o) => { if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).dispose(); });
  };

  const dansVigne = (x: number, z: number): boolean => {
    const [i, j] = celluleDe(x, z);
    for (const id of parCase.get(cle(i, j)) ?? []) { const p = polys[id]; if (x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ && dansPoly(x, z, p.pts)) return true; }
    return false;
  };
  const contraindre = (ox: number, oz: number, p: { x: number; z: number }): void => {
    if (!dansVigne(p.x, p.z) || surRoute(p.x, p.z)) return;
    const [i, j] = celluleDe(dansVigne(ox, oz) ? ox : p.x, dansVigne(ox, oz) ? oz : p.z);
    const th = angleDeNiveau(niveauAngle(i, j)); const nx = -Math.sin(th); const nz = Math.cos(th);
    const depart = dansVigne(ox, oz) && !surRoute(ox, oz) ? ox * nx + oz * nz : p.x * nx + p.z * nz;
    const c = Math.round(depart / ESPACEMENT_RANGS) * ESPACEMENT_RANGS; // axe de l'inter-rang (les pieds sont à ±0,55 m)
    const t = p.x * nx + p.z * nz;
    const lim = ESPACEMENT_RANGS / 2 - 0.25;
    const t2 = Math.min(c + lim, Math.max(c - lim, t));
    p.x += (t2 - t) * nx; p.z += (t2 - t) * nz;
  };

  return {
    groupe,
    contraindre,
    saison: (m) => { mois = m; for (const c of chunks.values()) appliquer(c); },
    stats: () => ({ proches: [...chunks.values()].filter((c) => c.etat === 'proche').length, moyens: [...chunks.values()].filter((c) => c.etat === 'moyen').length }),
    mettreAJour: (px, pz) => {
      const [ci, cj] = celluleDe(px, pz);
      let aConstruire: { i: number; j: number; etat: 'proche' | 'moyen'; d: number } | null = null;
      for (let i = ci - 4; i <= ci + 4; i++) for (let j = cj - 4; j <= cj + 4; j++) {
        if (!parCase.has(cle(i, j))) continue;
        const cx = BORNES.minX + (i + 0.5) * CELLULE; const cz = BORNES.minZ + (j + 0.5) * CELLULE;
        const dist = Math.hypot(cx - px, cz - pz) - CELLULE * 0.4;
        const c = chunks.get(cle(i, j));
        let voulu: 'proche' | 'moyen' | null = dist < (c?.etat === 'proche' ? 120 : 95) ? 'proche' : dist < 250 ? 'moyen' : null;
        if (voulu === 'moyen' && FEUILLES[mois] < 0.15) voulu = null; // en hiver, les rangs dessinés dans le sol suffisent
        if (c && voulu !== c.etat) { liberer(c); chunks.delete(cle(i, j)); }
        if (voulu && (!c || voulu !== c.etat) && (!aConstruire || dist < aConstruire.d)) aConstruire = { i, j, etat: voulu, d: dist };
      }
      for (const [k, c] of chunks) { // carrés trop éloignés
        const cx = BORNES.minX + (c.i + 0.5) * CELLULE; const cz = BORNES.minZ + (c.j + 0.5) * CELLULE;
        if (Math.hypot(cx - px, cz - pz) > 330) { liberer(c); chunks.delete(k); }
      }
      if (aConstruire) { // un seul carré par image, pour ne pas saccader
        const c = aConstruire.etat === 'proche' ? construireProche(aConstruire.i, aConstruire.j) : construireMoyen(aConstruire.i, aConstruire.j);
        if (c) { chunks.set(cle(aConstruire.i, aConstruire.j), c); groupe.add(c.groupe); }
        else chunks.set(cle(aConstruire.i, aConstruire.j), { i: aConstruire.i, j: aConstruire.j, etat: aConstruire.etat, groupe: new Group(), pieds: new Float32Array(0), runs: [], th: 0, meshes: {} });
      }
    },
  };
}
