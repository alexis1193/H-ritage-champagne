import type { DonneesCarte } from '../cartes/types';

/** Limites du monde (mises à jour au chargement de la carte). x : ouest-est, z : nord = valeurs négatives. */
export const BORNES = { minX: -130, maxX: 130, minZ: -100, maxZ: 70 };

export const lisse = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let grille: Int16Array = new Int16Array(4);
let nx = 2;
let nz = 2;
let pas = 5;

/** Installe le relief réel (RGE ALTI de l'IGN). Les altitudes sont comptées à partir du point le plus bas de la carte. */
export function definirRelief(d: DonneesCarte): void {
  const bin = atob(d.relief);
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  grille = new Int16Array(octets.buffer);
  nx = d.nx; nz = d.nz; pas = d.pas;
  Object.assign(BORNES, d.bornes);
}

export const GRILLE = { get nx() { return nx; }, get nz() { return nz; }, get pas() { return pas; } };

/** Altitude du terrain en mètres au-dessus du point le plus bas de la carte (interpolation entre les points de la grille). */
export function hauteurTerrain(x: number, z: number): number {
  const fx = Math.min(nx - 1.001, Math.max(0, (x - BORNES.minX) / pas));
  const fz = Math.min(nz - 1.001, Math.max(0, (z - BORNES.minZ) / pas));
  const ix = Math.floor(fx); const iz = Math.floor(fz); const tx = fx - ix; const tz = fz - iz;
  const g = (a: number, b: number): number => grille[b * nx + a] / 10;
  return (g(ix, iz) * (1 - tx) + g(ix + 1, iz) * tx) * (1 - tz) + (g(ix, iz + 1) * (1 - tx) + g(ix + 1, iz + 1) * tx) * tz;
}

/** Pente (mètres de dénivelé par mètre) autour d'un point. */
export function penteTerrain(x: number, z: number): number {
  return Math.hypot(hauteurTerrain(x + 4, z) - hauteurTerrain(x - 4, z), hauteurTerrain(x, z + 4) - hauteurTerrain(x, z - 4)) / 8;
}
