import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Group,
  IcosahedronGeometry, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Shape, type Texture,
} from 'three';
import { hauteurTerrain, BORNES } from './terrain';
import { LIEUX, PARCELLES, VIGNES_VOISINS, type Lieu, type Rect } from './lieux';
import { matiereArdoise, matierePierre, matierePlatre, matiereTuiles, type Matiere } from './textures';

/** Générateur pseudo-aléatoire déterministe : le village est toujours le même. */
function graine(s: number): () => number {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- matières (PBR : couleur + relief + rugosité) ----------
type Type = 'mur' | 'pierre' | 'tuile' | 'ardoise';
const TEXEL: Record<Type, number> = { mur: 3, pierre: 2.5, tuile: 1.6, ardoise: 1.4 };
const matieres: Partial<Record<Type, Matiere>> = {};
function matiere(t: Type): Matiere {
  let m = matieres[t];
  if (!m) {
    m = { mur: matierePlatre, pierre: matierePierre, tuile: matiereTuiles, ardoise: matiereArdoise }[t]();
    matieres[t] = m;
  }
  return m;
}
const cache = new Map<string, MeshStandardMaterial>();
function mat(couleur: string, type?: Type): MeshStandardMaterial {
  const cle = `${couleur}|${type ?? ''}`;
  let m = cache.get(cle);
  if (!m) {
    if (type) {
      const x = matiere(type);
      m = new MeshStandardMaterial({ color: couleur, map: x.couleur as Texture, normalMap: x.relief, roughness: type === 'ardoise' ? 0.55 : 0.92, metalness: 0 });
    } else {
      m = new MeshStandardMaterial({ color: couleur, roughness: 0.85, metalness: 0 });
    }
    cache.set(cle, m);
  }
  return m;
}

/** Les coordonnées de texture sont en mètres / taille du motif, pour que les briques gardent la même taille partout. */
function echelleUV(geo: BufferGeometry, ex: number, ey: number): void {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ex, uv.getY(i) * ey);
}

function ombre(o: Object3D): void {
  o.traverse((n) => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; } });
}

function boite(g: Group, w: number, h: number, d: number, couleur: string, x = 0, y = 0, z = 0, type?: Type): Mesh {
  const geo = new BoxGeometry(w, h, d);
  if (type) {
    // ordre des faces : +x, -x, +y, -y, +z, -z
    const uv = geo.attributes.uv; const t = TEXEL[type];
    const tailles: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) uv.setXY(f * 4 + k, (uv.getX(f * 4 + k) * tailles[f][0]) / t, (uv.getY(f * 4 + k) * tailles[f][1]) / t);
  }
  const m = new Mesh(geo, mat(couleur, type));
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

/** Toit à deux pans, faîtage le long de z. */
function toit(g: Group, w: number, h: number, d: number, couleur: string, y: number, x = 0, z = 0): Mesh {
  const s = new Shape();
  s.moveTo(-w / 2 - 0.4, 0); s.lineTo(w / 2 + 0.4, 0); s.lineTo(0, h); s.closePath();
  const geo: BufferGeometry = new ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.8) / 2);
  const type: Type = couleur === ARDOISE ? 'ardoise' : 'tuile';
  echelleUV(geo, 1 / TEXEL[type], 1 / TEXEL[type]);
  const m = new Mesh(geo, mat(couleur, type));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

function fenetres(g: Group, w: number, h: number, d: number, n: number, y = 1.4): void {
  const verre = new MeshStandardMaterial({ color: '#2f3b47', roughness: 0.15, metalness: 0.2 });
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -w / 2 + (w * (i + 0.5)) / n;
    for (const dy of h > 5 ? [0, 3] : [0]) {
      const cadre = boite(g, 1.0, 1.3, 0.1, '#f2ede0', x, y + dy - 0.1, d / 2 + 0.03);
      cadre.castShadow = false;
      const f = new Mesh(new BoxGeometry(0.76, 1.06, 0.06), verre);
      f.position.set(x, y + dy + 0.55, d / 2 + 0.07);
      g.add(f);
    }
  }
}

function socle(g: Group, w: number, d: number): void {
  boite(g, w + 0.4, 4, d + 0.4, '#b4ad98', 0, -3.6, 0, 'pierre');
}

const MUR = '#ece0c4';
const TUILE = '#c0603f';
const ARDOISE = '#5b6672';

function maison(w: number, d: number, h: number, couleurToit = TUILE, couleurMur = MUR): Group {
  const g = new Group();
  socle(g, w, d);
  boite(g, w, h, d, couleurMur, 0, 0, 0, 'mur');
  toit(g, w, h * 0.55, d, couleurToit, h, 0, 0);
  fenetres(g, w, h, d, Math.max(2, Math.round(w / 3)));
  boite(g, 1.1, 2.0, 0.14, '#6a4a2f', w * 0.25, 0, d / 2 + 0.03);
  return g;
}

function batimentPour(l: Lieu): Group | null {
  switch (l.id) {
    case 'maison': {
      const g = maison(10, 7, 4.6);
      boite(g, 1, 3, 1, '#9a7a68', 3, 4.6, -1.5, 'pierre');
      return g;
    }
    case 'pressoir': {
      const g = new Group();
      socle(g, 11, 8);
      boite(g, 11, 4, 8, '#d9c8a0', 0, 0, 0, 'mur');
      toit(g, 11, 2.6, 8, '#8a4f38', 4);
      boite(g, 3.6, 3.2, 0.14, '#5b422c', 0, 0, 4.03);
      const cuve = new Mesh(new CylinderGeometry(1.4, 1.4, 3, 14), new MeshStandardMaterial({ color: '#aab3b8', roughness: 0.35, metalness: 0.8 }));
      cuve.position.set(7, 1.5, 1);
      g.add(cuve);
      return g;
    }
    case 'cave': {
      const g = new Group();
      const falaise = new Mesh(new BoxGeometry(16, 9, 7), mat('#ece6d2', 'pierre'));
      echelleUV(falaise.geometry, 3, 3);
      falaise.position.set(0, 3, -3);
      g.add(falaise);
      boite(g, 12, 4.2, 5, '#e2dbc3', 0, 0, 2, 'pierre');
      boite(g, 3.2, 3.4, 0.4, '#25221f', 0, 0, 4.55);
      const arche = new Mesh(new CylinderGeometry(1.6, 1.6, 0.4, 16, 1, false, 0, Math.PI), mat('#25221f'));
      arche.rotation.x = Math.PI / 2; arche.rotation.z = Math.PI / 2;
      arche.position.set(0, 3.4, 4.55);
      g.add(arche);
      boite(g, 5, 0.5, 1.2, '#8a7a65', 0, 4.2, 4.6, 'pierre');
      return g;
    }
    case 'chateau': {
      const g = new Group();
      socle(g, 24, 11);
      boite(g, 24, 8, 11, '#f0e5ca', 0, 0, 0, 'mur');
      const t = toit(g, 11, 5, 24, ARDOISE, 8, 0, 0);
      t.rotation.y = Math.PI / 2;
      for (const sx of [-12, 12]) {
        const tour = new Mesh(new CylinderGeometry(3, 3.2, 13, 14), mat('#f0e5ca'));
        tour.position.set(sx, 6.5, 2.5);
        g.add(tour);
        const c = new Mesh(new ConeGeometry(3.8, 6, 14), mat(ARDOISE, 'ardoise'));
        c.position.set(sx, 16, 2.5);
        g.add(c);
      }
      fenetres(g, 20, 8, 11, 6, 1.6);
      boite(g, 3, 3.6, 0.2, '#5a4332', 0, 0, 5.6);
      return g;
    }
    case 'notaire': {
      const g = maison(7, 6, 7, ARDOISE, '#ded7c5');
      boite(g, 2.2, 0.8, 0.12, '#b88a2a', -1.6, 2.7, 3.12);
      return g;
    }
    case 'eglise': {
      const g = new Group();
      socle(g, 9, 15);
      boite(g, 8, 6.5, 14, '#f2e6c6', 0, 0, 0, 'pierre');
      toit(g, 8, 3.6, 14, ARDOISE, 6.5, 0, 0);
      boite(g, 4.6, 13, 4.6, '#f2e6c6', 0, 0, 8, 'pierre');
      const fleche = new Mesh(new ConeGeometry(3.4, 9, 4), mat(ARDOISE, 'ardoise'));
      fleche.rotation.y = Math.PI / 4;
      fleche.position.set(0, 17.5, 8);
      g.add(fleche);
      boite(g, 0.3, 1.8, 0.3, '#caa64a', 0, 21.8, 8);
      boite(g, 1.1, 0.3, 0.3, '#caa64a', 0, 22.9, 8);
      for (const sx of [-3, 3]) boite(g, 0.9, 2.6, 0.12, '#4a5a78', sx, 2.2, -7.02);
      for (const sx of [-4.02, 4.02]) boite(g, 0.12, 2.6, 0.9, '#4a5a78', sx, 2.4, -1);
      boite(g, 1.6, 2.6, 0.2, '#5a4332', 0, 0, 10.35);
      return g;
    }
    case 'loge': {
      const g = new Group();
      boite(g, 3.6, 2.4, 3.2, '#d8d0b8', 0, -0.2, 0, 'pierre');
      toit(g, 3.6, 1.6, 3.2, ARDOISE, 2.2, 0, 0);
      boite(g, 0.9, 1.6, 0.12, '#5a4332', 0, -0.2, 1.62);
      return g;
    }
    default:
      return null;
  }
}

/** Bâtiments (formes simples habillées de matières ; l'étape 7 les remplacera par de vrais modèles). */
export function construireBatiments(): Group {
  const g = new Group();
  for (const l of LIEUX) {
    const b = batimentPour(l);
    if (!b) continue;
    const y = Math.max(hauteurTerrain(l.x, l.z), hauteurTerrain(l.x - 3, l.z + 3)) + 0.25;
    b.position.set(l.x, l.id === 'loge' ? hauteurTerrain(l.x, l.z) + 0.6 : l.id === 'cave' ? hauteurTerrain(l.x, l.z) : y, l.z);
    ombre(b);
    g.add(b);
  }
  for (const h of maisonsDecor()) {
    const m = maison(h.w, h.d, h.h, h.toit, h.mur);
    m.position.set(h.x, hauteurTerrain(h.x, h.z) + 0.25, h.z);
    ombre(m);
    g.add(m);
  }
  return g;
}

interface MaisonDecor { x: number; z: number; w: number; d: number; h: number; toit: string; mur: string }

/** Maisons du village (décor), toujours les mêmes. */
function maisonsDecor(): MaisonDecor[] {
  const r = graine(42);
  const positions: [number, number][] = [
    [-90, 30], [-72, 30], [-52, 31], [-36, 30], [-20, 30], [28, 31], [42, 29], [78, 29], [96, 30], [112, 30],
    [-100, 14], [-84, 10], [90, 14], [104, 8], [38, 12], [-62, 12],
  ];
  const toits = [TUILE, '#a94f38', ARDOISE, '#c96f45'];
  const libres = positions.filter(([x, z]) => LIEUX.every((l) => l.collision === 0 || Math.hypot(x - l.x, z - l.z) > l.collision + 14));
  return libres.map(([x, z]) => ({
    x, z, w: 6 + r() * 3, d: 5 + r() * 2, h: 3.6 + r() * 1.6,
    toit: toits[Math.floor(r() * toits.length)], mur: r() > 0.5 ? MUR : '#e3d6b4',
  }));
}

/** Positions des obstacles ronds (bâtiments), pour que le joueur ne les traverse pas. */
export function obstacles(): { x: number; z: number; r: number }[] {
  const o = LIEUX.filter((l) => l.collision > 0).map((l) => ({ x: l.x, z: l.z, r: l.collision }));
  for (const h of maisonsDecor()) o.push({ x: h.x, z: h.z, r: Math.max(h.w, h.d) / 2 + 1 });
  return o;
}

const dansRect = (x: number, z: number, r: Rect, m = 0): boolean =>
  x > r.xMin - m && x < r.xMax + m && z > r.zMin - m && z < r.zMax + m;

function toutesParcelles(): Rect[] {
  return [...Object.values(PARCELLES).map((p) => p.rect), ...VIGNES_VOISINS];
}

interface Arbre { x: number; z: number; s: number; feuillu: boolean }
let arbresCache: Arbre[] | null = null;

/** Emplacements des arbres : forêt au sommet, sur les flancs, et quelques-uns au village. */
export function pointsArbres(): Arbre[] {
  if (arbresCache) return arbresCache;
  const r = graine(3);
  const pts: Arbre[] = [];
  const rects = toutesParcelles();
  const interdit = (x: number, z: number): boolean => {
    if (rects.some((rc) => dansRect(x, z, rc, 3))) return true;
    for (const l of LIEUX) if (Math.hypot(x - l.x, z - l.z) < l.collision + 5) return true;
    return z > 34 && z < 43; // route
  };
  for (let x = BORNES.minX + 4; x < BORNES.maxX - 4; x += 3.4) {
    for (let z = BORNES.minZ + 3; z < 46; z += 3.4) {
      const px = x + (r() - 0.5) * 2.6;
      const pz = z + (r() - 0.5) * 2.6;
      const foret = pz < -64 || (Math.abs(px) > 76 && pz < -2);
      const village = pz > 0 && r() < 0.012;
      const f = r() < 0.45;
      if ((foret || village) && !interdit(px, pz)) pts.push({ x: px, z: pz, s: 0.8 + r() * 0.7, feuillu: village ? true : f });
    }
  }
  arbresCache = pts;
  return pts;
}

export interface Arbres { groupe: Group; saison: (mois: number) => void }

const FEUILLAGE_MOIS = ['#7d6e55', '#7d6e55', '#8a7a55', '#9cbf5a', '#74a83a', '#4f8a2c', '#4a8228', '#4a8228', '#5a8a2a', '#c58a2a', '#a05a28', '#7d6e55'];
const ECHELLE_MOIS = [0.55, 0.55, 0.6, 0.8, 1, 1, 1, 1, 1, 0.95, 0.7, 0.55];

/** Résineux (toute l'année) et feuillus (qui suivent les saisons), instanciés. */
export function construireArbres(): Arbres {
  const g = new Group();
  const pts = pointsArbres();
  const conifere = pts.filter((p) => !p.feuillu);
  const feuillu = pts.filter((p) => p.feuillu);
  const troncMat = mat('#5b4632');
  const troncC = new InstancedMesh(new CylinderGeometry(0.25, 0.35, 2, 6), troncMat, conifere.length);
  const cone = new InstancedMesh(new ConeGeometry(1.9, 6.4, 7), mat('#4d6a3c'), conifere.length);
  const troncF = new InstancedMesh(new CylinderGeometry(0.22, 0.4, 3.2, 6), troncMat, feuillu.length);
  const houppier = new InstancedMesh(new IcosahedronGeometry(2.3, 1), mat('#74a83a'), feuillu.length);
  const d = new Object3D();
  const c = new Color();
  const r = graine(9);
  conifere.forEach((p, i) => {
    const y = hauteurTerrain(p.x, p.z);
    d.position.set(p.x, y + p.s, p.z); d.scale.set(p.s, p.s, p.s); d.rotation.y = 0; d.updateMatrix();
    troncC.setMatrixAt(i, d.matrix);
    d.position.set(p.x, y + 2.2 + 3.2 * p.s, p.z); d.rotation.y = r() * 6; d.updateMatrix();
    cone.setMatrixAt(i, d.matrix);
    c.set('#4d6a3c').offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.1);
    cone.setColorAt(i, c);
  });
  feuillu.forEach((p, i) => {
    const y = hauteurTerrain(p.x, p.z);
    d.position.set(p.x, y + 1.6 * p.s, p.z); d.scale.set(p.s, p.s, p.s); d.rotation.set(0, 0, 0); d.updateMatrix();
    troncF.setMatrixAt(i, d.matrix);
  });
  g.add(troncC, cone, troncF, houppier);
  for (const m of [troncC, cone, troncF, houppier]) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; }
  const alea = feuillu.map(() => r());
  const saison = (mois: number): void => {
    feuillu.forEach((p, i) => {
      const k = ECHELLE_MOIS[mois] * (0.85 + 0.3 * alea[i]);
      const y = hauteurTerrain(p.x, p.z);
      d.position.set(p.x, y + (3.4 + 1.1 * k) * p.s, p.z); d.scale.set(p.s * k * 1.1, p.s * k, p.s * k * 1.1); d.rotation.set(0, alea[i] * 6, 0); d.updateMatrix();
      houppier.setMatrixAt(i, d.matrix);
      c.set(FEUILLAGE_MOIS[mois]).offsetHSL((alea[i] - 0.5) * 0.06, 0, (alea[i] - 0.5) * 0.12);
      houppier.setColorAt(i, c);
    });
    houppier.instanceMatrix.needsUpdate = true;
    if (houppier.instanceColor) houppier.instanceColor.needsUpdate = true;
  };
  for (const m of [troncC, cone, troncF]) m.instanceMatrix.needsUpdate = true;
  if (cone.instanceColor) cone.instanceColor.needsUpdate = true;
  saison(0);
  return { groupe: g, saison };
}

