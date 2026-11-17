import {
  CanvasTexture, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, NoColorSpace,
  PlaneGeometry, RGBAFormat, SRGBColorSpace, UnsignedByteType, Vector2,
} from 'three';
import { BORNES, bruitMonde, hauteurTerrain, lisse } from './terrain';
import { CHEMINS, VIGNES_VOISINS, PARCELLES, type Rect } from './lieux';
import { matiereSol } from './textures';

/**
 * Sol du village. Au lieu de poser des rubans (qui scintillaient), les chemins, les rangs de vigne,
 * l'herbe et les ombres de contact sont « peints » une seule fois dans de grandes images collées sur le terrain.
 */

const W = 1536;
const H = 1004;
const px = (x: number): number => ((x - BORNES.minX) / (BORNES.maxX - BORNES.minX)) * W;
const pz = (z: number): number => ((z - BORNES.minZ) / (BORNES.maxZ - BORNES.minZ)) * H;
const metre = W / (BORNES.maxX - BORNES.minX);

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true });
  if (!c) throw new Error('canvas 2d indisponible');
  return [cv, c];
}

const hex = (s: string): [number, number, number] => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export interface Sol { mesh: Mesh; herbe: { value: Color }; maj: (dt: number) => void }

export interface ObstacleAO { x: number; z: number; r: number }

export function construireSol(obstacles: ObstacleAO[], arbres: { x: number; z: number }[], anisotropie: number): Sol {
  // --- 1. fond : couleur du sol nu et masque d'herbe, pixel par pixel
  const [cvCol, cCol] = canvas();
  const [, cHerbe] = canvas();
  const [, cAO] = canvas();
  const imgCol = cCol.createImageData(W, H);
  const imgHerbe = cHerbe.createImageData(W, H);
  const terre = hex('#a89b7e'); const craie = hex('#dcd5bf'); const litiere = hex('#5f5a3c'); const berge = hex('#8c8465');
  for (let j = 0; j < H; j++) {
    const z = BORNES.minZ + ((j + 0.5) / H) * (BORNES.maxZ - BORNES.minZ);
    const pente = lisse(14, -64, z);
    for (let i = 0; i < W; i++) {
      const x = BORNES.minX + ((i + 0.5) / W) * (BORNES.maxX - BORNES.minX);
      const n = bruitMonde(x, z);
      let col = mix(terre, craie, Math.min(1, Math.max(0, (n - 0.45) * 1.6)));
      let herbe = 1;
      if (n > 0.7 && pente > 0.25) herbe = Math.max(0, 1 - (n - 0.7) * 8); // affleurements de craie
      if (z < -62) { col = mix(col, litiere, 0.85); herbe = 0.35; }
      if (z > 44) { col = mix(col, berge, lisse(44, 52, z)); herbe *= 1 - 0.7 * lisse(46, 54, z); }
      const k = (j * W + i) * 4;
      imgCol.data[k] = col[0]; imgCol.data[k + 1] = col[1]; imgCol.data[k + 2] = col[2]; imgCol.data[k + 3] = 255;
      const hv = herbe * 255;
      imgHerbe.data[k] = hv; imgHerbe.data[k + 1] = hv; imgHerbe.data[k + 2] = hv; imgHerbe.data[k + 3] = 255;
    }
  }
  cCol.putImageData(imgCol, 0, 0);
  cHerbe.putImageData(imgHerbe, 0, 0);
  cAO.fillStyle = '#fff';
  cAO.fillRect(0, 0, W, H);

  // --- 2. peinture des formes (bords adoucis par plusieurs passes, sans filtre)
  const trace = (c: CanvasRenderingContext2D, pts: [number, number][], largeur: number, couleur: string): void => {
    c.strokeStyle = couleur; c.lineWidth = largeur * metre; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.forEach(([x, z], i) => (i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z))));
    c.stroke();
  };
  for (const ch of CHEMINS) {
    const route = ch.largeur > 3;
    for (const [extra, a] of [[1.4, 0.18], [0.9, 0.3], [0.45, 0.5]] as const) {
      cHerbe.globalAlpha = a; trace(cHerbe, ch.points, ch.largeur + extra, '#000');
      cCol.globalAlpha = a; trace(cCol, ch.points, ch.largeur + extra, route ? '#5f5d58' : '#b9b196');
    }
    cHerbe.globalAlpha = 1; trace(cHerbe, ch.points, ch.largeur, '#000');
    cCol.globalAlpha = 1; trace(cCol, ch.points, ch.largeur, route ? '#85827b' : '#ece6d2');
    if (route) { cCol.globalAlpha = 0.9; trace(cCol, ch.points, 0.18, '#d8d2c0'); cCol.globalAlpha = 1; }
  }
  const parcelles: Rect[] = [...Object.values(PARCELLES).map((p) => p.rect), ...VIGNES_VOISINS];
  for (const r of parcelles) {
    // tournière de craie autour, herbe entre les rangs, sol nu sous les rangs
    cCol.fillStyle = '#cfc7ad'; cCol.fillRect(px(r.xMin - 1), pz(r.zMin - 1), px(r.xMax + 1) - px(r.xMin - 1), pz(r.zMax + 1) - pz(r.zMin - 1));
    cHerbe.fillStyle = '#000'; cHerbe.fillRect(px(r.xMin - 1), pz(r.zMin - 1), px(r.xMax + 1) - px(r.xMin - 1), pz(r.zMax + 1) - pz(r.zMin - 1));
    cHerbe.fillStyle = '#fff'; cHerbe.fillRect(px(r.xMin), pz(r.zMin), px(r.xMax) - px(r.xMin), pz(r.zMax) - pz(r.zMin));
    for (let z = r.zMin + 1; z < r.zMax; z += 2) {
      cHerbe.fillStyle = '#111'; cHerbe.fillRect(px(r.xMin), pz(z - 0.35), px(r.xMax) - px(r.xMin), 0.7 * metre);
      cCol.fillStyle = '#b3a98e'; cCol.fillRect(px(r.xMin), pz(z - 0.35), px(r.xMax) - px(r.xMin), 0.7 * metre);
      cAO.fillStyle = 'rgba(0,0,0,0.30)'; cAO.fillRect(px(r.xMin), pz(z - 0.55), px(r.xMax) - px(r.xMin), 1.1 * metre);
    }
  }
  const tache = (c: CanvasRenderingContext2D, x: number, z: number, r: number, a: number, r0 = 0.3): void => {
    const g = c.createRadialGradient(px(x), pz(z), r * r0 * metre, px(x), pz(z), r * metre);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(px(x - r), pz(z - r), 2 * r * metre, 2 * r * metre);
  };
  for (const o of obstacles) {
    tache(cAO, o.x, o.z, o.r + 3.5, 0.75, 0.55);
    tache(cHerbe, o.x, o.z, o.r + 2.5, 0.8, 0.5); // cour de terre battue autour des bâtiments
  }
  for (const a of arbres) tache(cAO, a.x, a.z, 2.3, 0.4);

  // --- 3. textures
  const colTex = new CanvasTexture(cvCol);
  colTex.colorSpace = SRGBColorSpace;
  colTex.anisotropy = anisotropie;
  // R = herbe, G = ombre de contact (ambient occlusion peinte). Les lignes sont retournées (le haut de l'image est le nord).
  const dh = cHerbe.getImageData(0, 0, W, H).data;
  const da = cAO.getImageData(0, 0, W, H).data;
  const masque = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    const src = (H - 1 - j) * W * 4;
    for (let i = 0; i < W; i++) {
      const k = j * W * 4 + i * 4;
      masque[k] = dh[src + i * 4]; masque[k + 1] = da[src + i * 4]; masque[k + 2] = 255; masque[k + 3] = 255;
    }
  }
  const masqueTex = new DataTexture(masque, W, H, RGBAFormat, UnsignedByteType);
  masqueTex.colorSpace = NoColorSpace;
  masqueTex.magFilter = LinearFilter; masqueTex.minFilter = LinearMipmapLinearFilter; masqueTex.generateMipmaps = true;
  masqueTex.anisotropy = anisotropie;
  masqueTex.needsUpdate = true;

  const grain = matiereSol();
  const REP = new Vector2(88, 58); // un motif tous les 3 m
  grain.relief.repeat.copy(REP);
  const herbe = { value: new Color('#9c9a68') };
  const mat = new MeshStandardMaterial({ map: colTex, normalMap: grain.relief, normalScale: new Vector2(0.9, 0.9), roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.masque = { value: masqueTex };
    sh.uniforms.grain = { value: grain.couleur };
    sh.uniforms.herbe = herbe;
    sh.uniforms.repetition = { value: REP };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform sampler2D masque; uniform sampler2D grain; uniform vec3 herbe; uniform vec2 repetition;\nvoid main() {')
      .replace('#include <map_fragment>', `
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        vec4 mk = texture2D( masque, vMapUv );
        vec2 ud = vMapUv * repetition;
        float d1 = texture2D( grain, ud ).r;
        float d2 = texture2D( grain, ud * 0.17 ).r;
        float dd = 0.5 + 0.9 * ( d1 * 0.55 + d2 * 0.45 );
        vec3 nu = sampledDiffuseColor.rgb * dd;
        vec3 pre = herbe * ( 0.55 + 0.9 * ( d1 * 0.4 + d2 * 0.6 ) );
        diffuseColor.rgb *= mix( nu, pre, mk.r ) * mk.g;
      `);
  };

  // --- 4. maillage lisse (1,25 m)
  const larg = BORNES.maxX - BORNES.minX;
  const prof = BORNES.maxZ - BORNES.minZ;
  const geo = new PlaneGeometry(larg, prof, 208, 136);
  geo.rotateX(-Math.PI / 2);
  geo.translate((BORNES.maxX + BORNES.minX) / 2, 0, (BORNES.maxZ + BORNES.minZ) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hauteurTerrain(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, herbe, maj: () => undefined };
}
