import type { Partie } from './types';

/** Hasard reproductible (mulberry32) : la même graine donne la même partie, ce qui permet de tester et d'équilibrer. */
export function suivant(p: { rng: number }): number {
  p.rng = (p.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(p.rng ^ (p.rng >>> 15), 1 | p.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const entre = (p: Partie, a: number, b: number): number => a + (b - a) * suivant(p);
export const entier = (p: Partie, a: number, b: number): number => Math.floor(entre(p, a, b + 1));
export const tirage = (p: Partie, proba: number): boolean => suivant(p) < proba;
