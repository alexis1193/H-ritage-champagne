import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial,
  PlaneGeometry, Quaternion, Vector3, DoubleSide, Euler,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hauteurTerrain } from './terrain';
import { PARCELLES, VIGNES_VOISINS, type Rect } from './lieux';
import { textureFeuilles } from './textures';

/**
 * Vignes détaillées, entièrement instanciées (quelques appels de dessin pour des milliers de pieds) :
 * piquets, fils de palissage, tronc, bras (cordon), rameaux, feuilles, grappes.
 * L'aspect suit le mois (0 = janvier … 11 = décembre).
 */

const ECART_RANGS = 2.0;
const ECART_PIEDS = 1.0;

function hasard(graine: number): () => number {
  let s = graine | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pied { x: number; y: number; z: number; rot: number; echelle: number; cepage: 0 | 1 | 2; dx: number[]; lean: number[]; auj: number }

/** Évolution de l'aspect par mois : taille des feuilles, longueur des rameaux, grappes, couleurs. */
const FEUILLES = [0, 0, 0.04, 0.4, 0.75, 1, 1, 1, 1, 0.9, 0.35, 0];
const RAMEAUX = [0.14, 0.14, 0.16, 0.45, 0.85, 1, 1, 1, 1, 1, 0.9, 0.2];
const GRAPPES = [0, 0, 0, 0, 0, 0.3, 0.55, 0.8, 1, 0, 0, 0]; // octobre : vendangé
const COUL_FEUILLES = ['#8a7a4a', '#8a7a4a', '#a9c46a', '#a3cc55', '#7fb43c', '#5a9a30', '#4f8c2f', '#4f8c2f', '#5f8f2a', '#c9a030', '#a8622a', '#8a7a4a'];
const COUL_RAMEAUX = ['#6b5238', '#6b5238', '#7a6a3a', '#9cc24a', '#7fb43c', '#6aa233', '#5a9a30', '#5a9a30', '#6a8a3a', '#8a6a3a', '#7a5a3a', '#6b5238'];
const BLANC = [new Color('#9dbb58'), new Color('#aebf5a'), new Color('#c8c25a'), new Color('#d8c768')];
const NOIR = [new Color('#8fb050'), new Color('#7f6a8a'), new Color('#4a3558'), new Color('#2a1a3a')];

const ROUGE = new Color('#a5442a');

function etapeGrappe(mois: number): number {
  // 0 vert … 3 mûr
  return mois <= 5 ? 0 : mois === 6 ? 0 : mois === 7 ? 1 : mois === 8 ? 3 : 3;
}

export interface Vigne { groupe: Group; saison: (mois: number) => void }

export function construireVignes(): Vigne {
  const r = hasard(7);
  const rects: { rc: Rect; cepage: 0 | 1 | 2 }[] = [
    ...Object.values(PARCELLES).map((p) => ({ rc: p.rect, cepage: (p.cepage === 'chardonnay' ? 0 : p.cepage === 'pinot noir' ? 1 : 2) as 0 | 1 | 2 })),
    ...VIGNES_VOISINS.map((rc, i) => ({ rc, cepage: (i % 3) as 0 | 1 | 2 })),
  ];
  const pieds: Pied[] = [];
  const rangs: { x0: number; x1: number; y: number; z: number }[] = [];
  const poteaux: { x: number; y: number; z: number }[] = [];
  for (const { rc, cepage } of rects) {
    for (let z = rc.zMin + 1; z < rc.zMax; z += ECART_RANGS) {
      rangs.push({ x0: rc.xMin, x1: rc.xMax, y: hauteurTerrain((rc.xMin + rc.xMax) / 2, z), z });
      let n = 0;
      for (let x = rc.xMin + 0.5; x < rc.xMax; x += ECART_PIEDS, n++) {
        const y = hauteurTerrain(x, z);
        pieds.push({ x, y, z, rot: (r() - 0.5) * 0.5, echelle: 0.85 + r() * 0.3, cepage, dx: [(r() - 0.5) * 0.15, (r() - 0.5) * 0.1, (r() - 0.5) * 0.15], lean: [(r() - 0.5) * 0.3, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3], auj: r() });
        if (n % 5 === 0) poteaux.push({ x: x - 0.5, y: hauteurTerrain(x - 0.5, z), z });
      }
      poteaux.push({ x: rc.xMax, y: hauteurTerrain(rc.xMax, z), z });
    }
  }
  const N = pieds.length;
  const groupe = new Group();

  // --- géométries
  const geoTronc = new CylinderGeometry(0.03, 0.05, 0.66, 5); geoTronc.translate(0, 0.33, 0);
  const geoBras = new CylinderGeometry(0.02, 0.026, 1.0, 5); geoBras.rotateZ(Math.PI / 2); geoBras.translate(0, 0.66, 0);
  const geoRameau = new CylinderGeometry(0.006, 0.012, 1, 4); geoRameau.translate(0, 0.5, 0);
  const geoGrappe = new ConeGeometry(0.07, 0.22, 6); geoGrappe.rotateX(Math.PI); geoGrappe.translate(0, -0.11, 0);
  const plans: BufferGeometry[] = [];
  for (const a of [0, 0.9, -0.9]) { const p = new PlaneGeometry(1.1, 0.95); p.rotateY(a); plans.push(p); }
  const geoFeuilles = mergeGeometries(plans);
  const geoPoteau = new BoxGeometry(0.07, 1.75, 0.07); geoPoteau.translate(0, 0.875, 0);
  const geoFil = new BoxGeometry(1, 0.012, 0.012);

  // --- matériaux
  const bois = new MeshStandardMaterial({ color: '#6e5a40', roughness: 0.95 });
  const matRameau = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const matFeuilles = new MeshStandardMaterial({ map: textureFeuilles(), alphaTest: 0.5, side: DoubleSide, roughness: 0.75, color: '#ffffff' });
  const matGrappe = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const matPoteau = new MeshStandardMaterial({ color: '#8d7c5e', roughness: 0.9 });
  const matFil = new MeshStandardMaterial({ color: '#b6babd', roughness: 0.4, metalness: 0.7 });

  const troncs = new InstancedMesh(geoTronc, bois, N);
  const bras = new InstancedMesh(geoBras, bois, N);
  const rameaux = new InstancedMesh(geoRameau, matRameau, N * 3);
  const feuilles = new InstancedMesh(geoFeuilles, matFeuilles, N);
  const grappes = new InstancedMesh(geoGrappe, matGrappe, N);
  const piquets = new InstancedMesh(geoPoteau, matPoteau, poteaux.length);
  const fils = new InstancedMesh(geoFil, matFil, rangs.length * 3);
  for (const m of [troncs, bras, rameaux, feuilles, grappes, piquets, fils]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; }
  groupe.add(troncs, bras, rameaux, feuilles, grappes, piquets, fils);

  const m4 = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const un = new Vector3(1, 1, 1);
  const pos = new Vector3();
  const sc = new Vector3();

  pieds.forEach((p, i) => {
    q.setFromEuler(e.set(0, p.rot, p.lean[0] * 0.2));
    troncs.setMatrixAt(i, m4.compose(pos.set(p.x + p.dx[0] * 0.3, p.y, p.z), q, sc.set(p.echelle, p.echelle, p.echelle)));
    bras.setMatrixAt(i, m4.compose(pos.set(p.x, p.y, p.z), q.setFromEuler(e.set(0, 0, p.lean[1] * 0.05)), un));
  });
  piquets.count = poteaux.length;
  poteaux.forEach((p, i) => piquets.setMatrixAt(i, m4.compose(pos.set(p.x, p.y, p.z), q.identity(), un)));
  rangs.forEach((rg, i) => {
    [0.66, 1.08, 1.45].forEach((h, k) => {
      const longueur = rg.x1 - rg.x0;
      fils.setMatrixAt(i * 3 + k, m4.compose(pos.set((rg.x0 + rg.x1) / 2, hauteurTerrain((rg.x0 + rg.x1) / 2, rg.z) + h, rg.z), q.identity(), sc.set(longueur, 1, 1)));
    });
  });
  troncs.instanceMatrix.needsUpdate = bras.instanceMatrix.needsUpdate = piquets.instanceMatrix.needsUpdate = fils.instanceMatrix.needsUpdate = true;

  const cF = new Color();
  const cG = new Color();
  const saison = (mois: number): void => {
    const f = FEUILLES[mois]; const ra = RAMEAUX[mois]; const gr = GRAPPES[mois];
    const etape = etapeGrappe(mois);
    pieds.forEach((p, i) => {
      // feuillage : un mur de feuilles autour des fils
      const g = Math.max(0.0001, f * (0.9 + 0.2 * p.auj));
      cF.set(COUL_FEUILLES[mois]);
      if (mois === 9 && p.cepage !== 0) cF.lerp(ROUGE, 0.5); // le pinot rougit
      cF.offsetHSL((p.auj - 0.5) * 0.05, 0, (p.auj - 0.5) * 0.12);
      feuilles.setMatrixAt(i, m4.compose(pos.set(p.x, p.y + 0.78 + 0.45 * g, p.z), q.setFromEuler(e.set(0, p.rot, 0)), sc.set(g * 1.05, g, g)));
      feuilles.setColorAt(i, cF);
      // rameaux : trois par pied
      for (let k = 0; k < 3; k++) {
        const len = Math.max(0.0001, ra * (0.8 + 0.4 * p.auj));
        q.setFromEuler(e.set(p.lean[k] * 0.4, 0, p.lean[(k + 1) % 3] * 0.3));
        rameaux.setMatrixAt(i * 3 + k, m4.compose(pos.set(p.x + (k - 1) * 0.28 + p.dx[k], p.y + 0.66, p.z), q, sc.set(1, len * 0.9, 1)));
        cG.set(COUL_RAMEAUX[mois]).offsetHSL(0, 0, (p.auj - 0.5) * 0.06);
        rameaux.setColorAt(i * 3 + k, cG);
      }
      // grappes
      const gs = gr * (0.7 + 0.6 * p.auj);
      q.setFromEuler(e.set(0, p.rot, 0));
      grappes.setMatrixAt(i, m4.compose(pos.set(p.x + p.dx[2], p.y + 0.66, p.z + 0.13), q, sc.set(Math.max(0.0001, gs), Math.max(0.0001, gs), Math.max(0.0001, gs))));
      grappes.setColorAt(i, (p.cepage === 0 ? BLANC : NOIR)[etape]);
    });
    for (const m of [feuilles, rameaux, grappes]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  };
  saison(0);
  return { groupe, saison };
}
