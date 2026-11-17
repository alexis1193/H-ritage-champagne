import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Object3D, Shape,
} from 'three';
import { hauteurTerrain, BORNES } from './terrain';
import { CHEMINS, LIEUX, PARCELLES, VIGNES_VOISINS, type Lieu, type Rect } from './lieux';

const matCache = new Map<string, MeshLambertMaterial>();
const mat = (couleur: string): MeshLambertMaterial => {
  let m = matCache.get(couleur);
  if (!m) { m = new MeshLambertMaterial({ color: couleur }); matCache.set(couleur, m); }
  return m;
};

/** Générateur pseudo-aléatoire déterministe : le village est toujours le même. */
function graine(s: number): () => number {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ombre(o: Object3D, coule = true, recoit = true): void {
  o.traverse((n) => { if (n instanceof Mesh) { n.castShadow = coule; n.receiveShadow = recoit; } });
}

function boite(g: Group, w: number, h: number, d: number, couleur: string, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat(couleur));
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

/** Toit à deux pans, faîtage le long de z. */
function toit(g: Group, w: number, h: number, d: number, couleur: string, y: number, x = 0, z = 0): void {
  const s = new Shape();
  s.moveTo(-w / 2 - 0.4, 0); s.lineTo(w / 2 + 0.4, 0); s.lineTo(0, h); s.closePath();
  const geo: BufferGeometry = new ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.8) / 2);
  const m = new Mesh(geo, mat(couleur));
  m.position.set(x, y, z);
  g.add(m);
}

function fenetres(g: Group, w: number, h: number, d: number, n: number, y = 1.4): void {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -w / 2 + (w * (i + 0.5)) / n;
    const f = boite(g, 0.8, 1.1, 0.12, '#3b4651', x, y, d / 2 + 0.02);
    f.castShadow = false;
    if (h > 5) { const f2 = boite(g, 0.8, 1.1, 0.12, '#3b4651', x, y + 3, d / 2 + 0.02); f2.castShadow = false; }
  }
}

function socle(g: Group, w: number, d: number): void {
  boite(g, w + 0.4, 4, d + 0.4, '#a7a08a', 0, -3.6, 0);
}

const MUR = '#e9ddbf';
const TUILE = '#a8573b';
const ARDOISE = '#454f5c';

function maison(w: number, d: number, h: number, couleurToit = TUILE, couleurMur = MUR): Group {
  const g = new Group();
  socle(g, w, d);
  boite(g, w, h, d, couleurMur);
  toit(g, w, h * 0.55, d, couleurToit, h, 0, 0);
  fenetres(g, w, h, d, Math.max(2, Math.round(w / 3)));
  boite(g, 1.1, 2.0, 0.14, '#6a4a2f', w * 0.25, 0, d / 2 + 0.03);
  return g;
}

function batimentPour(l: Lieu): Group | null {
  switch (l.id) {
    case 'maison': {
      const g = maison(10, 7, 4.6);
      boite(g, 1, 3, 1, '#8a6a58', 3, 4.6, -1.5);
      return g;
    }
    case 'pressoir': {
      const g = new Group();
      socle(g, 11, 8);
      boite(g, 11, 4, 8, '#c9b48a');
      toit(g, 11, 2.6, 8, '#7a4a35', 4);
      boite(g, 3.6, 3.2, 0.14, '#5b422c', 0, 0, 4.03);
      const cuve = new Mesh(new CylinderGeometry(1.4, 1.4, 3, 12), mat('#9aa4a8'));
      cuve.position.set(7, 1.5, 1);
      g.add(cuve);
      return g;
    }
    case 'cave': {
      const g = new Group();
      const falaise = new Mesh(new BoxGeometry(16, 9, 7), mat('#ece6d2'));
      falaise.position.set(0, 3, -3);
      g.add(falaise);
      boite(g, 12, 4.2, 5, '#dcd5bd', 0, 0, 2);
      boite(g, 3.2, 3.4, 0.4, '#2d2a26', 0, 0, 4.55);
      const arche = new Mesh(new CylinderGeometry(1.6, 1.6, 0.4, 14, 1, false, 0, Math.PI), mat('#2d2a26'));
      arche.rotation.x = Math.PI / 2; arche.rotation.z = Math.PI / 2;
      arche.position.set(0, 3.4, 4.55);
      g.add(arche);
      boite(g, 5, 0.5, 1.2, '#7a6a55', 0, 4.2, 4.6);
      return g;
    }
    case 'chateau': {
      const g = new Group();
      socle(g, 24, 11);
      boite(g, 24, 8, 11, '#efe3c7');
      toit(g, 11, 5, 24, ARDOISE, 8, 0, 0);
      g.children[g.children.length - 1].rotation.y = Math.PI / 2;
      for (const sx of [-12, 12]) {
        const t = new Mesh(new CylinderGeometry(3, 3.2, 13, 10), mat('#efe3c7'));
        t.position.set(sx, 6.5, 2.5);
        g.add(t);
        const c = new Mesh(new ConeGeometry(3.8, 6, 10), mat(ARDOISE));
        c.position.set(sx, 16, 2.5);
        g.add(c);
      }
      fenetres(g, 20, 8, 11, 6, 1.6);
      boite(g, 3, 3.6, 0.2, '#5a4332', 0, 0, 5.6);
      return g;
    }
    case 'notaire': {
      const g = maison(7, 6, 7, ARDOISE, '#d9d2c0');
      boite(g, 2.2, 0.8, 0.12, '#b88a2a', -1.6, 2.7, 3.12);
      return g;
    }
    case 'eglise': {
      const g = new Group();
      socle(g, 9, 15);
      boite(g, 8, 6.5, 14, '#e4dcc4', 0, 0, 0);
      toit(g, 8, 3.6, 14, ARDOISE, 6.5, 0, 0);
      boite(g, 4.6, 13, 4.6, '#e4dcc4', 0, 0, 8);
      const fleche = new Mesh(new ConeGeometry(3.4, 9, 4), mat(ARDOISE));
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
      boite(g, 3.6, 2.4, 3.2, '#d8d0b8', 0, -0.2, 0);
      toit(g, 3.6, 1.6, 3.2, ARDOISE, 2.2, 0, 0);
      boite(g, 0.9, 1.6, 0.12, '#5a4332', 0, -0.2, 1.62);
      return g;
    }
    default:
      return null;
  }
}

/** Bâtiments (formes simples ; l'étape 7 les remplacera par de vrais modèles). */
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
  const toits = [TUILE, '#9a4a35', ARDOISE, '#b8643f'];
  const libres = positions.filter(([x, z]) => LIEUX.every((l) => l.collision === 0 || Math.hypot(x - l.x, z - l.z) > l.collision + 14));
  return libres.map(([x, z]) => ({
    x, z, w: 6 + r() * 3, d: 5 + r() * 2, h: 3.6 + r() * 1.6,
    toit: toits[Math.floor(r() * toits.length)], mur: r() > 0.5 ? MUR : '#e0d3b0',
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

/** Rangs de vigne (hiver : souches nues, brunes). Une seule instance par pied pour rester léger. */
export function construireVignes(): InstancedMesh {
  const geo = new BoxGeometry(1.05, 0.9, 0.2);
  geo.translate(0, 0.45, 0);
  const rects = toutesParcelles();
  const pas = 1.0;
  const ecart = 2.0;
  const mats: Matrix4[] = [];
  const r = graine(7);
  for (const rc of rects) {
    for (let z = rc.zMin + 1; z < rc.zMax; z += ecart) {
      for (let x = rc.xMin + 1; x < rc.xMax; x += pas) {
        const m = new Matrix4();
        m.makeScale(1, 0.85 + r() * 0.3, 1).setPosition(x, hauteurTerrain(x, z), z);
        mats.push(m);
      }
    }
  }
  const im = new InstancedMesh(geo, mat('#8c7a5a'), mats.length);
  const c = new Color();
  mats.forEach((m, i) => {
    im.setMatrixAt(i, m);
    c.set('#8c7a5a').offsetHSL(0, 0, (r() - 0.5) * 0.06);
    im.setColorAt(i, c);
  });
  im.castShadow = false;
  im.receiveShadow = true;
  return im;
}

/** Forêt au sommet du coteau et sur les flancs, quelques arbres au village. */
export function construireArbres(): Group {
  const g = new Group();
  const r = graine(3);
  const pts: { x: number; z: number; s: number }[] = [];
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
      if ((foret || village) && !interdit(px, pz)) pts.push({ x: px, z: pz, s: 0.8 + r() * 0.7 });
    }
  }
  const tronc = new InstancedMesh(new CylinderGeometry(0.25, 0.35, 2, 5), mat('#5b4632'), pts.length);
  const feuilles = new InstancedMesh(new ConeGeometry(1.8, 6, 6), mat('#5d7048'), pts.length);
  const d = new Object3D();
  const c = new Color();
  pts.forEach((p, i) => {
    const y = hauteurTerrain(p.x, p.z);
    d.position.set(p.x, y + p.s, p.z); d.scale.set(p.s, p.s, p.s); d.rotation.y = 0; d.updateMatrix();
    tronc.setMatrixAt(i, d.matrix);
    d.position.set(p.x, y + 2 + 3 * p.s, p.z); d.rotation.y = r() * 6; d.updateMatrix();
    feuilles.setMatrixAt(i, d.matrix);
    c.set('#5d7048').offsetHSL((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.1);
    feuilles.setColorAt(i, c);
  });
  g.add(tronc, feuilles);
  return g;
}

/** Chemins de craie et route : rubans posés sur le terrain. */
export function construireChemins(): Group {
  const g = new Group();
  for (const ch of CHEMINS) {
    const pts = ch.points;
    const pos: number[] = [];
    const idx: number[] = [];
    const echant: { x: number; z: number; nx: number; nz: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 2));
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n;
        echant.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, nx, nz });
      }
    }
    echant.forEach((e, i) => {
      const demi = ch.largeur / 2;
      for (const s of [-1, 1]) {
        const x = e.x + e.nx * demi * s;
        const z = e.z + e.nz * demi * s;
        pos.push(x, hauteurTerrain(x, z) + 0.12, z);
      }
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const bg = new BufferGeometry();
    bg.setAttribute('position', new Float32BufferAttribute(pos, 3));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    const m = new Mesh(bg, new MeshLambertMaterial({ color: ch.couleur, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}
