import {
  BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshLambertMaterial, PlaneGeometry,
} from 'three';

/** Limites du monde (x : ouest-est, z : nord = valeurs négatives, sud = positives). */
export const BORNES = { minX: -130, maxX: 130, minZ: -100, maxZ: 70 };

const lisse = (a: number, b: number, x: number): number => {
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

const bruit = (x: number, z: number): number =>
  0.5 + 0.25 * Math.sin(x * 0.11 + z * 0.07) + 0.25 * Math.sin(x * 0.05 - z * 0.13 + 2);

const HERBE_HIVER = new Color('#b3ad83');
const HERBE_SOMBRE = new Color('#9c9a72');
const CRAIE = new Color('#e6e0cb');
const FORET = new Color('#6f7a55');
const BERGE = new Color('#a29a78');

/** Terrain en facettes plates (look low-poly), coloré par triangle. */
export function construireTerrain(): Mesh {
  const larg = BORNES.maxX - BORNES.minX;
  const prof = BORNES.maxZ - BORNES.minZ;
  const plan = new PlaneGeometry(larg, prof, 130, 90);
  plan.rotateX(-Math.PI / 2);
  plan.translate((BORNES.maxX + BORNES.minX) / 2, 0, (BORNES.maxZ + BORNES.minZ) / 2);
  const pos = plan.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hauteurTerrain(pos.getX(i), pos.getZ(i)));
  const geo: BufferGeometry = plan.toNonIndexed();
  geo.computeVertexNormals();
  const p = geo.attributes.position;
  const couleurs = new Float32Array(p.count * 3);
  const c = new Color();
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    const n = bruit(cx, cz);
    c.copy(HERBE_HIVER).lerp(HERBE_SOMBRE, n * 0.6);
    const pente = lisse(14, -64, cz);
    if (n > 0.72 && pente > 0.25) c.lerp(CRAIE, (n - 0.72) * 2.6); // affleurements de craie
    if (cz < -62) c.lerp(FORET, 0.8);
    if (cz > 44) c.lerp(BERGE, lisse(44, 52, cz));
    c.offsetHSL(0, 0, (Math.sin(t * 12.9898) * 0.5) * 0.02);
    for (let k = 0; k < 3; k++) c.toArray(couleurs, (t + k) * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(couleurs, 3));
  const m = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true;
  return m;
}
