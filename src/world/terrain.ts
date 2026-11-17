/** Limites du monde (x : ouest-est, z : nord = valeurs négatives, sud = positives). */
export const BORNES = { minX: -130, maxX: 130, minZ: -100, maxZ: 70 };

export const lisse = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Altitude du terrain : village plat au sud, coteau qui monte vers le nord, la Marne en contrebas. */
export function hauteurTerrain(x: number, z: number): number {
  const pente = lisse(14, -64, z);
  let h = pente * 18;
  h += Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05) * 2.0 * pente;
  h += lisse(62, 112, Math.abs(x)) * lisse(34, -20, z) * 9; // flancs de la vallée
  h -= 3.2 * lisse(44, 56, z); // berge de la Marne
  return h;
}

/** Bruit doux et déterministe (pour les taches de craie, etc.). */
export const bruitMonde = (x: number, z: number): number =>
  0.5 + 0.25 * Math.sin(x * 0.11 + z * 0.07) + 0.25 * Math.sin(x * 0.05 - z * 0.13 + 2);
