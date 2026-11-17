import {
  CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGBAFormat, RepeatWrapping,
  SRGBColorSpace, UnsignedByteType,
} from 'three';

/**
 * Textures générées par le programme (aucun fichier à télécharger) :
 * une image de couleur (clarté) + une carte de relief (normales) pour chaque matière.
 * Elles pourront être remplacées par de vraies photos libres de droits (ambientCG, Poly Haven).
 */

function hasard(graine: number): () => number {
  let s = graine | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit qui se raccorde sur lui-même (la texture se répète sans couture), valeurs de 0 à 1. */
export function bruitPeriodique(taille: number, periodes: number[], poids: number[], graine: number): Float32Array {
  const out = new Float32Array(taille * taille);
  const r = hasard(graine);
  let total = 0;
  periodes.forEach((P, k) => {
    const g = new Float32Array(P * P);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const w = poids[k];
    total += w;
    for (let y = 0; y < taille; y++) {
      const fy = (y / taille) * P; const iy = Math.floor(fy); const ty = fy - iy; const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < taille; x++) {
        const fx = (x / taille) * P; const ix = Math.floor(fx); const tx = fx - ix; const sx = tx * tx * (3 - 2 * tx);
        const a = g[(iy % P) * P + (ix % P)]; const b = g[(iy % P) * P + ((ix + 1) % P)];
        const c = g[((iy + 1) % P) * P + (ix % P)]; const d = g[((iy + 1) % P) * P + ((ix + 1) % P)];
        out[y * taille + x] += w * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
  });
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function donnees(taille: number, data: Uint8Array, srgb: boolean): DataTexture {
  const t = new DataTexture(data, taille, taille, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Relief : transforme une carte de hauteurs en carte de normales. */
export function normalesDepuis(h: Float32Array, taille: number, force: number): DataTexture {
  const data = new Uint8Array(taille * taille * 4);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const dx = h[y * taille + ((x + 1) % taille)] - h[y * taille + ((x - 1 + taille) % taille)];
      const dy = h[((y + 1) % taille) * taille + x] - h[((y - 1 + taille) % taille) * taille + x];
      let nx = -dx * force; let ny = dy * force; const nz = 1;
      const n = Math.hypot(nx, ny, nz); nx /= n; ny /= n;
      const i = (y * taille + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255; data[i + 1] = (ny * 0.5 + 0.5) * 255; data[i + 2] = (nz / n * 0.5 + 0.5) * 255; data[i + 3] = 255;
    }
  }
  return donnees(taille, data, false);
}

/** Image de clarté (gris) : se teinte ensuite avec la couleur du matériau. */
export function grisDepuis(a: Float32Array, taille: number): DataTexture {
  const data = new Uint8Array(taille * taille * 4);
  for (let i = 0; i < a.length; i++) {
    const v = Math.max(0, Math.min(1, a[i])) * 255;
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return donnees(taille, data, true);
}

export interface Matiere { couleur: DataTexture; relief: DataTexture }

const T = 256;
const hash2 = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Sol : grain fin utilisé sur toute la surface du terrain. */
export function matiereSol(): Matiere {
  const h = bruitPeriodique(T, [8, 16, 32, 64], [1, 0.8, 0.6, 0.5], 11);
  return { couleur: grisDepuis(h, T), relief: normalesDepuis(h, T, 5) };
}

/** Crépi / plâtre des murs. */
export function matierePlatre(): Matiere {
  const h = bruitPeriodique(T, [16, 32, 64, 128], [0.6, 1, 0.8, 0.5], 21);
  const taches = bruitPeriodique(T, [3, 6], [1, 0.6], 22);
  const a = new Float32Array(T * T);
  for (let i = 0; i < a.length; i++) a[i] = 0.82 + 0.18 * h[i] - 0.14 * Math.max(0, taches[i] - 0.55);
  return { couleur: grisDepuis(a, T), relief: normalesDepuis(h, T, 2) };
}

/** Pierre de taille / soubassement. */
export function matierePierre(): Matiere {
  const h = new Float32Array(T * T); const a = new Float32Array(T * T);
  const bruit = bruitPeriodique(T, [16, 48], [1, 0.7], 31);
  const bh = 32;
  for (let y = 0; y < T; y++) {
    const rang = Math.floor(y / bh); const off = (rang % 2) * 32; const bw = 64;
    for (let x = 0; x < T; x++) {
      const xx = (x + off) % T; const fx = (xx % bw) / bw; const fy = (y % bh) / bh;
      const bloc = Math.floor(xx / bw) + rang * 7;
      const joint = Math.min(fx, 1 - fx) < 0.03 || Math.min(fy, 1 - fy) < 0.05;
      const i = y * T + x;
      h[i] = joint ? 0.25 : 0.6 + 0.4 * bruit[i];
      a[i] = joint ? 0.55 : 0.7 + 0.15 * hash2(bloc, 3) + 0.12 * (bruit[i] - 0.5);
    }
  }
  return { couleur: grisDepuis(a, T), relief: normalesDepuis(h, T, 4) };
}

/** Tuiles canal / mécaniques : rangs décalés. */
export function matiereTuiles(): Matiere {
  const h = new Float32Array(T * T); const a = new Float32Array(T * T);
  const bruit = bruitPeriodique(T, [32, 64], [1, 0.6], 41);
  const rang = 32; const larg = 32;
  for (let y = 0; y < T; y++) {
    const r = Math.floor(y / rang); const off = (r % 2) * (larg / 2); const fy = (y % rang) / rang;
    for (let x = 0; x < T; x++) {
      const xx = (x + off) % T; const fx = (xx % larg) / larg; const id = Math.floor(xx / larg) + r * 13;
      const i = y * T + x;
      const bord = fx < 0.05 || fx > 0.95 || fy > 0.93;
      h[i] = bord ? 0 : Math.sin(Math.PI * fx) * 0.6 + 0.4 * fy;
      a[i] = bord ? 0.3 : 0.72 + 0.25 * hash2(id, 9) + 0.1 * (bruit[i] - 0.5) - 0.12 * (1 - fy) * (1 - fy);
    }
  }
  return { couleur: grisDepuis(a, T), relief: normalesDepuis(h, T, 5) };
}

/** Ardoises : petits rectangles décalés. */
export function matiereArdoise(): Matiere {
  const h = new Float32Array(T * T); const a = new Float32Array(T * T);
  const bruit = bruitPeriodique(T, [32, 96], [1, 0.5], 51);
  const rang = 20; const larg = 36;
  for (let y = 0; y < T; y++) {
    const r = Math.floor(y / rang); const off = (r % 2) * (larg / 2); const fy = (y % rang) / rang;
    for (let x = 0; x < T; x++) {
      const xx = (x + off) % T; const fx = (xx % larg) / larg; const id = Math.floor(xx / larg) + r * 17;
      const i = y * T + x;
      const bord = fx < 0.04 || fx > 0.96 || fy > 0.9;
      h[i] = bord ? 0 : 0.5 + 0.5 * fy;
      a[i] = bord ? 0.3 : 0.7 + 0.25 * hash2(id, 5) + 0.08 * (bruit[i] - 0.5);
    }
  }
  return { couleur: grisDepuis(a, T), relief: normalesDepuis(h, T, 4) };
}

/** Relief de l'eau (vaguelettes). */
export function reliefEau(): DataTexture {
  const h = bruitPeriodique(T, [4, 8, 16, 32], [1, 0.7, 0.4, 0.2], 61);
  return normalesDepuis(h, T, 3);
}

/** Feuille de vigne avec transparence : un bouquet de feuilles lobées. */
export function textureFeuilles(): CanvasTexture {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  if (!c) throw new Error('canvas 2d indisponible');
  const r = hasard(5);
  for (let k = 0; k < 11; k++) {
    const x = 14 + r() * (S - 28); const y = 14 + r() * (S - 28); const a = r() * Math.PI * 2; const s = 17 + r() * 9;
    const g = 150 + Math.floor(r() * 90);
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = `rgb(${g},${g},${g})`;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2; const rad = s * (i % 2 ? 0.62 : 1);
      c.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    c.closePath(); c.fill();
    c.strokeStyle = `rgba(0,0,0,0.35)`; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(s, 0); c.moveTo(0, 0); c.lineTo(s * 0.6, s * 0.6); c.moveTo(0, 0); c.lineTo(s * 0.6, -s * 0.6); c.stroke();
    c.restore();
  }
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
