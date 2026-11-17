import { BORNES, hauteurTerrain } from './terrain';

/** Les rangs de vigne suivent les courbes de niveau. L'orientation est calculée par carré de 60 m et partagée
 *  entre le sol (rangs dessinés au loin) et les pieds 3D (près du joueur), pour qu'ils coïncident exactement. */
export const CELLULE = 60;
export const NIVEAUX = 32;
export const ESPACEMENT_RANGS = 1.1;
export const ESPACEMENT_PIEDS = 1.0;

export const celluleDe = (x: number, z: number): [number, number] =>
  [Math.floor((x - BORNES.minX) / CELLULE), Math.floor((z - BORNES.minZ) / CELLULE)];

/** Niveau d'angle (0 à 31) des rangs dans la cellule (i, j). */
export function niveauAngle(i: number, j: number): number {
  const x = BORNES.minX + (i + 0.5) * CELLULE;
  const z = BORNES.minZ + (j + 0.5) * CELLULE;
  const gx = hauteurTerrain(x + 8, z) - hauteurTerrain(x - 8, z);
  const gz = hauteurTerrain(x, z + 8) - hauteurTerrain(x, z - 8);
  let a = Math.atan2(gx, -gz);
  a = ((a % Math.PI) + Math.PI) % Math.PI;
  return Math.round((a / Math.PI) * NIVEAUX) % NIVEAUX;
}

export const angleDeNiveau = (k: number): number => (k / NIVEAUX) * Math.PI;
