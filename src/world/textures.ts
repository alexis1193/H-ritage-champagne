import {
  CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGBAFormat, RepeatWrapping,
  SRGBColorSpace, UnsignedByteType,
} from 'three';

/** Textures générées par le programme : relief de l'eau et feuilles de vigne. Les matières des murs, toits et sols sont de vraies photos (voir matieres.ts). */

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

const T = 256;

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
