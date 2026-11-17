import {
  BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh,
  MeshStandardMaterial, Shape, ShapeGeometry, Color, type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DonneesCarte } from '../cartes/types';
import { hauteurTerrain } from './terrain';
import { LIEUX } from './lieux';
import type { Matieres } from './matieres';

/** Bâtiments réels (contours BD TOPO de l'IGN) extrudés à leur hauteur, avec toits à deux pans quand la forme s'y prête. */

const TEXEL = { mur: 3.2, tuile: 1.8, ardoise: 1.6, pierre: 3 };
const MURS = ['#e6d9bd', '#dccfae', '#e9e1d0', '#d6c6a0', '#d0c3a8', '#e2d4b5', '#e8dcc0'];
const TUILES = ['#ffcfb4', '#ffbd9c', '#ffd9c0', '#f5b49a', '#ffc6a8'];
const ARDOISES = ['#d4dae2', '#bfc6cf', '#e0e5ea'];

const hash = (n: number): number => { let h = (n * 374761393) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function coloriser(geo: BufferGeometry, couleur: string): BufferGeometry {
  const n = geo.attributes.position.count;
  const c = new Color(couleur);
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new Float32BufferAttribute(a, 3));
  return geo;
}
function echelleUV(geo: BufferGeometry, k: number): void {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / k, uv.getY(i) / k);
}
/** Prépare un morceau de géométrie pour la fusion : même liste d'attributs partout. */
function normaliser(g: BufferGeometry): BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}

function matPBR(m: { couleur: MeshStandardMaterial['map']; relief: MeshStandardMaterial['normalMap'] }, rugosite: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ map: m.couleur, normalMap: m.relief, vertexColors: true, roughness: rugosite, metalness: 0 });
}

interface Obb { cx: number; cz: number; long: number; court: number; angle: number; ratio: number }

function boiteOrientee(pts: [number, number][]): Obb {
  let bestA = 0; let bestAire = Infinity; let res: Obb | null = null;
  const aire = (p: [number, number][]): number => { let s = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i]; const [x2, z2] = p[(i + 1) % p.length]; s += x1 * z2 - x2 * z1; } return Math.abs(s) / 2; };
  const a0 = aire(pts);
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]; const [x2, z2] = pts[(i + 1) % pts.length];
    const a = Math.atan2(z2 - z1, x2 - x1); const c = Math.cos(a); const s = Math.sin(a);
    let u0 = 1e9; let u1 = -1e9; let v0 = 1e9; let v1 = -1e9;
    for (const [x, z] of pts) { const u = x * c + z * s; const v = -x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (A < bestAire) {
      bestAire = A; bestA = a;
      const cu = (u0 + u1) / 2; const cv = (v0 + v1) / 2;
      const long = Math.max(u1 - u0, v1 - v0); const court = Math.min(u1 - u0, v1 - v0);
      const alongU = u1 - u0 >= v1 - v0;
      res = { cx: cu * c - cv * s, cz: cu * s + cv * c, long, court, angle: alongU ? a : a + Math.PI / 2, ratio: a0 / A };
    }
  }
  void bestA;
  return res as Obb;
}

export function construireBatiments(d: DonneesCarte, m: Matieres, aniso: number): Group {
  void aniso;
  const murs: BufferGeometry[] = []; const tuiles: BufferGeometry[] = []; const ardoises: BufferGeometry[] = []; const pierres: BufferGeometry[] = [];
  const egliseId = LIEUX.find((l) => l.id === 'eglise')?.batiment;

  d.batiments.forEach((b, idx) => {
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < b.p.length; i += 2) pts.push([b.p[i], b.p[i + 1]]);
    if (pts.length < 3) return;
    let base = 1e9;
    for (const [x, z] of pts) base = Math.min(base, hauteurTerrain(x, z));
    const obb = boiteOrientee(pts);
    const eglise = idx === egliseId;
    const gable = (obb.ratio > 0.72 && obb.court > 3.5 && obb.long > 4) || eglise;
    const total = b.h > 1 ? b.h : b.e > 0 ? b.e * 3 + 3 : 6;
    const rh = gable ? Math.min(Math.max(obb.court * 0.3, 1.6), eglise ? 7 : 5.2) : 0;
    const hMur = Math.max(2.6, gable ? total - rh * 0.6 : total);
    const rnd = hash(idx + 7);

    // murs
    const shape = new Shape(pts.map(([x, z]) => ({ x, y: -z } as never)));
    const mur = new ExtrudeGeometry(shape, { depth: hMur + 3, bevelEnabled: false });
    mur.rotateX(-Math.PI / 2);
    mur.translate(0, base - 3, 0);
    echelleUV(mur, eglise || b.u === 'e' ? TEXEL.pierre : TEXEL.mur);
    const teinte = eglise ? '#e8dfc4' : MURS[Math.floor(rnd * MURS.length)];
    (eglise ? pierres : murs).push(normaliser(coloriser(mur, teinte)));

    // toit
    const ardoise = eglise || b.u === 'e' || rnd > 0.82;
    const couleurToit = ardoise ? ARDOISES[Math.floor(hash(idx + 3) * ARDOISES.length)] : TUILES[Math.floor(hash(idx + 5) * TUILES.length)];
    const cibleToit = ardoise ? ardoises : tuiles;
    if (gable) {
      const s = new Shape();
      const w = obb.court;
      s.moveTo(-w / 2 - 0.35, 0); s.lineTo(w / 2 + 0.35, 0); s.lineTo(0, rh); s.closePath();
      const L = obb.long + 0.7;
      const toit = new ExtrudeGeometry(s, { depth: L, bevelEnabled: false });
      toit.translate(0, 0, -L / 2); // le faîtage court le long de z local
      toit.rotateY(-obb.angle + Math.PI / 2);
      toit.translate(obb.cx, base + hMur, obb.cz);
      echelleUV(toit, ardoise ? TEXEL.ardoise : TEXEL.tuile);
      cibleToit.push(normaliser(coloriser(toit, couleurToit)));
    } else {
      const cap = new ShapeGeometry(new Shape(pts.map(([x, z]) => ({ x, y: -z } as never))));
      cap.rotateX(-Math.PI / 2);
      cap.translate(0, base + hMur + 0.05, 0);
      echelleUV(cap, TEXEL.tuile);
      tuiles.push(normaliser(coloriser(cap, '#e8d0c0')));
    }
    if (eglise) { // clocher de l'abbatiale, à l'extrémité ouest du bâtiment
      const c = Math.cos(obb.angle); const s2 = Math.sin(obb.angle);
      const bx = obb.cx - c * (obb.long / 2 - 3.5); const bz = obb.cz - s2 * (obb.long / 2 - 3.5);
      const tour = new BoxGeometry(6.5, 24, 6.5); tour.rotateY(-obb.angle); tour.translate(bx, base + 12, bz);
      echelleUV(tour, TEXEL.pierre);
      pierres.push(normaliser(coloriser(tour, '#e8dfc4')));
      const fleche = new ConeGeometry(4.6, 13, 4); fleche.rotateY(Math.PI / 4 - obb.angle); fleche.translate(bx, base + 24 + 6.5, bz);
      echelleUV(fleche, TEXEL.ardoise);
      ardoises.push(normaliser(coloriser(fleche, '#a9b1bb')));
    }
  });

  const g = new Group();
  const faire = (liste: BufferGeometry[], mat: Material): void => {
    if (!liste.length) return;
    const mesh = new Mesh(mergeGeometries(liste, false), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
  };
  faire(murs, matPBR(m.platre, 0.92));
  faire(pierres, matPBR(m.pierre, 0.9));
  faire(tuiles, matPBR(m.tuile, 0.85));
  faire(ardoises, matPBR(m.ardoise, 0.6));

  // bâtiments inventés : le château de la maison de négoce (fictive) et la loge de vigne
  const inventes = new Group();
  const blanc = (mat: { couleur: MeshStandardMaterial['map']; relief: MeshStandardMaterial['normalMap'] }, couleur: string, rugo = 0.9): MeshStandardMaterial =>
    new MeshStandardMaterial({ map: mat.couleur, normalMap: mat.relief, color: couleur, roughness: rugo });
  const murCh = blanc(m.platre, '#f0e5ca'); const toitCh = blanc(m.ardoise, '#7a828b', 0.6); const pierre = blanc(m.pierre, '#d8d0b8');
  const ch = LIEUX.find((l) => l.id === 'chateau');
  if (ch) {
    const y = hauteurTerrain(ch.x, ch.z);
    const c = new Group();
    const box = (w: number, h: number, dd: number, mat: Material, x: number, yy: number, z: number): void => {
      const mm = new Mesh(new BoxGeometry(w, h, dd), mat); mm.position.set(x, yy + h / 2, z); mm.castShadow = mm.receiveShadow = true; c.add(mm);
    };
    box(34, 6, 16, pierre, 0, -5, 0);
    box(32, 11, 14, murCh, 0, 0, 0);
    const toit = new ExtrudeGeometry((() => { const s = new Shape(); s.moveTo(-8.5, 0); s.lineTo(8.5, 0); s.lineTo(0, 6.5); s.closePath(); return s; })(), { depth: 33, bevelEnabled: false });
    toit.translate(0, 0, -16.5); toit.rotateY(Math.PI / 2);
    const tm = new Mesh(toit, toitCh); tm.position.set(0, 11, 0); tm.castShadow = true; c.add(tm);
    for (const sx of [-16, 16]) {
      const tour = new Mesh(new CylinderGeometry(4, 4.3, 17, 16), murCh); tour.position.set(sx, 8.5, 3); tour.castShadow = true; c.add(tour);
      const cone = new Mesh(new ConeGeometry(5.2, 8, 16), toitCh); cone.position.set(sx, 21, 3); cone.castShadow = true; c.add(cone);
    }
    box(4, 5, 0.3, new MeshStandardMaterial({ color: '#5a4332' }), 0, 0, 7.1);
    c.position.set(ch.x, y + 0.2, ch.z);
    inventes.add(c);
  }
  const lg = LIEUX.find((l) => l.id === 'loge');
  if (lg) {
    const c = new Group();
    const b1 = new Mesh(new BoxGeometry(3.6, 2.4, 3.2), pierre); b1.position.y = 1.2; b1.castShadow = true; c.add(b1);
    const s = new Shape(); s.moveTo(-2.2, 0); s.lineTo(2.2, 0); s.lineTo(0, 1.6); s.closePath();
    const t = new ExtrudeGeometry(s, { depth: 3.8, bevelEnabled: false }); t.translate(0, 0, -1.9);
    const tm = new Mesh(t, toitCh); tm.position.y = 2.4; tm.castShadow = true; c.add(tm);
    const porte = new Mesh(new BoxGeometry(0.9, 1.6, 0.1), new MeshStandardMaterial({ color: '#5a4332' })); porte.position.set(0, 0.8, 1.62); c.add(porte);
    c.position.set(lg.x, hauteurTerrain(lg.x, lg.z), lg.z);
    inventes.add(c);
  }
  g.add(inventes);
  return g;
}
