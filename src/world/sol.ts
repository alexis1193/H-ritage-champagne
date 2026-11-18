import {
  CanvasTexture, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, NoColorSpace,
  PlaneGeometry, RGBAFormat, SRGBColorSpace, Texture, UnsignedByteType, Vector2,
} from 'three';
import type { DonneesCarte } from '../cartes/types';
import { BORNES, hauteurTerrain } from './terrain';
import { CELLULE, celluleDe, niveauAngle, ESPACEMENT_RANGS } from './rangs';
import type { Matieres } from './matieres';

/**
 * Sol de la vraie carte. Routes, chemins, vignes, bois, eau et ombres de contact sont « peints » une seule fois
 * dans de grandes images collées sur le terrain (pas de rubans qui scintillent). Un programme de dessin (shader)
 * ajoute les vraies textures photo, l'herbe de saison et les rangs de vigne.
 */

const W = 1280;
const FORET = new Set(['b', 'f', 'm', 'k', 'p', 'l', 'o']);

export interface Sol { mesh: Mesh; herbe: { value: Color }; givre: { value: number } }

function moyenneLineaire(t: Texture): number {
  const img = t.image as CanvasImageSource & { width: number; height: number };
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const c = cv.getContext('2d', { willReadFrequently: true });
  if (!c) return 0.2;
  c.drawImage(img, 0, 0, 16, 16);
  const d = c.getImageData(0, 0, 16, 16).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = (v: number): number => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    s += (l(d[i]) + l(d[i + 1]) + l(d[i + 2])) / 3;
  }
  return Math.max(0.02, s / 256);
}

export function construireSol(d: DonneesCarte, m: Matieres, anisotropie: number): Sol {
  const lx = BORNES.maxX - BORNES.minX;
  const lz = BORNES.maxZ - BORNES.minZ;
  const H = Math.round((W * lz) / lx);
  const px = (x: number): number => ((x - BORNES.minX) / lx) * W;
  const pz = (z: number): number => ((z - BORNES.minZ) / lz) * H;
  const metre = W / lx;

  const faire = (fond: string): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('canvas 2d indisponible');
    c.fillStyle = fond; c.fillRect(0, 0, W, H);
    return [cv, c];
  };
  const [cvCol, cCol] = faire('#b8ae92');
  const [cvHerbe, cHerbe] = faire('#ffffff');
  const [cvAO, cAO] = faire('#ffffff');
  const [cvRoute, cRoute] = faire('#000000');
  const [cvAng, cAng] = faire('#000000');

  const trace = (c: CanvasRenderingContext2D, flat: number[], ferme: boolean): void => {
    c.beginPath();
    for (let i = 0; i < flat.length; i += 2) (i ? c.lineTo(px(flat[i]), pz(flat[i + 1])) : c.moveTo(px(flat[i]), pz(flat[i + 1])));
    if (ferme) c.closePath();
  };
  const remplir = (c: CanvasRenderingContext2D, flat: number[], couleur: string, alpha = 1): void => {
    c.globalAlpha = alpha; c.fillStyle = couleur; trace(c, flat, true); c.fill(); c.globalAlpha = 1;
  };
  const ligne = (c: CanvasRenderingContext2D, flat: number[], largeur: number, couleur: string, alpha = 1): void => {
    c.globalAlpha = alpha; c.strokeStyle = couleur; c.lineWidth = Math.max(1, largeur * metre); c.lineCap = 'round'; c.lineJoin = 'round';
    trace(c, flat, false); c.stroke(); c.globalAlpha = 1;
  };

  // 1. végétation, eau
  for (const v of d.vegetation) {
    if (v.t === 'v') { remplir(cCol, v.p, '#c3b99c'); remplir(cHerbe, v.p, '#e6e6e6'); remplir(cAng, v.p, '#ffffff'); }
    else if (FORET.has(v.t)) { remplir(cCol, v.p, '#4a5a34'); remplir(cHerbe, v.p, '#707070'); remplir(cAO, v.p, '#000', 0.3); }
    else if (v.t === 'h') { remplir(cCol, v.p, '#3d5a2c'); remplir(cHerbe, v.p, '#404040'); remplir(cAO, v.p, '#000', 0.25); }
    else if (v.t === 'g') { remplir(cCol, v.p, '#9aa860'); }
  }
  for (const e of d.eau) { remplir(cCol, e.p, '#3f6e7c'); remplir(cHerbe, e.p, '#000'); }
  for (const c of d.cours) { ligne(cCol, c.p, 3, '#4f8090'); ligne(cHerbe, c.p, 3.5, '#000'); }
  // 2. routes et chemins (bords adoucis par plusieurs passes)
  for (const r of d.routes) {
    const route = r.c === 'r';
    for (const [extra, a] of [[1.6, 0.18], [0.9, 0.3], [0.4, 0.5]] as const) {
      ligne(cHerbe, r.p, r.w + extra, '#000', a);
      ligne(cCol, r.p, r.w + extra, route ? '#7a766c' : '#b9b196', a);
      if (route) ligne(cRoute, r.p, r.w + extra, '#fff', a);
    }
    ligne(cHerbe, r.p, r.w, '#000');
    ligne(cCol, r.p, r.w, route ? '#948f82' : r.c === 'e' ? '#cdc5ae' : '#e2dcc8');
    if (route) ligne(cRoute, r.p, r.w, '#fff');
  }
  // 3. bâtiments : cour de terre battue et ombre de contact
  for (const b of d.batiments) {
    ligne(cAO, b.p.concat(b.p.slice(0, 2)), 12, '#000', 0.12);
    ligne(cAO, b.p.concat(b.p.slice(0, 2)), 6, '#000', 0.2);
    ligne(cAO, b.p.concat(b.p.slice(0, 2)), 2.5, '#000', 0.3);
    ligne(cHerbe, b.p.concat(b.p.slice(0, 2)), 5, '#000', 0.6);
    remplir(cCol, b.p, '#a8a08a');
  }
  // 4. orientation des rangs : une valeur par carré de 60 m, multipliée par le masque des vignes
  cAng.globalCompositeOperation = 'multiply';
  const ni = Math.ceil(lx / CELLULE); const nj = Math.ceil(lz / CELLULE);
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const g = Math.round((niveauAngle(i, j) + 1) * 7);
    cAng.fillStyle = `rgb(${g},${g},${g})`;
    cAng.fillRect(px(BORNES.minX + i * CELLULE) - 0.5, pz(BORNES.minZ + j * CELLULE) - 0.5, CELLULE * metre + 1, CELLULE * metre + 1);
  }
  cAng.globalCompositeOperation = 'source-over';

  // 5. textures
  const colTex = new CanvasTexture(cvCol);
  colTex.colorSpace = SRGBColorSpace; colTex.anisotropy = anisotropie;
  const donnees = new Uint8Array(W * H * 4);
  const canaux: [HTMLCanvasElement, CanvasRenderingContext2D, number][] = [[cvHerbe, cHerbe, 0], [cvAO, cAO, 1], [cvRoute, cRoute, 2], [cvAng, cAng, 3]];
  for (const [cv, c, ch] of canaux) {
    const src = c.getImageData(0, 0, W, H).data;
    for (let j = 0; j < H; j++) {
      const s = (H - 1 - j) * W * 4; const t = j * W * 4;
      for (let i = 0; i < W; i++) donnees[t + i * 4 + ch] = src[s + i * 4];
    }
    cv.width = cv.height = 1; // libère la mémoire
  }
  const masque = new DataTexture(donnees, W, H, RGBAFormat, UnsignedByteType);
  masque.colorSpace = NoColorSpace; masque.magFilter = LinearFilter; masque.minFilter = LinearMipmapLinearFilter;
  masque.generateMipmaps = true; masque.anisotropy = anisotropie; masque.needsUpdate = true;

  const relief = m.herbe.relief.clone();
  relief.needsUpdate = true;
  relief.repeat.set(lx / 6, lz / 6);
  const herbe = { value: new Color('#8d9262') };
  const givre = { value: 0 };
  const mat = new MeshStandardMaterial({ map: colTex, normalMap: relief, normalScale: new Vector2(0.8, 0.8), roughness: 0.95, metalness: 0 });
  const mG = moyenneLineaire(m.herbe.couleur); const mN = moyenneLineaire(m.platre.couleur); const mA = moyenneLineaire(m.asphalte.couleur);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      masque: { value: masque }, herbeTex: { value: m.herbe.couleur }, craieTex: { value: m.platre.couleur }, asphalteTex: { value: m.asphalte.couleur },
      herbe, givre, norme: { value: [1 / mG, 1 / mN, 1 / mA] }, espacement: { value: ESPACEMENT_RANGS },
    });
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec2 vWxz;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = position.xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying vec2 vWxz; uniform sampler2D masque; uniform sampler2D herbeTex; uniform sampler2D craieTex; uniform sampler2D asphalteTex; uniform vec3 herbe; uniform vec3 norme; uniform float espacement; uniform float givre;\nvoid main() {')
      .replace('#include <map_fragment>', `
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        vec4 mk = texture2D( masque, vMapUv );
        vec2 uw = vWxz / 6.0;
        float lg = dot( texture2D( herbeTex, uw ).rgb, vec3( 0.3333 ) ) * 0.55 + dot( texture2D( herbeTex, uw * 0.11 + 0.3 ).rgb, vec3( 0.3333 ) ) * 0.45;
        vec3 herbeCol = herbe * ( lg * norme.x );
        float ln = dot( texture2D( craieTex, uw * 0.8 ).rgb, vec3( 0.3333 ) ) * 0.6 + dot( texture2D( craieTex, uw * 0.09 ).rgb, vec3( 0.3333 ) ) * 0.4;
        float la = dot( texture2D( asphalteTex, uw * 1.5 ).rgb, vec3( 0.3333 ) );
        vec3 nu = sampledDiffuseColor.rgb * mix( ln * norme.y, la * norme.z, mk.b );
        float herbeMix = mk.r;
        if ( mk.a > 0.02 ) nu *= 0.72;
        if ( mk.a > 0.02 ) {
          float k = floor( mk.a * 255.0 / 7.0 + 0.5 ) - 1.0;
          float th = k / 32.0 * 3.14159265;
          float r = dot( vWxz, vec2( -sin( th ), cos( th ) ) ) / espacement;
          float aa = fwidth( r );
          float dd = abs( fract( r ) - 0.5 );
          float strip = 1.0 - smoothstep( 0.17 - aa * 0.5, 0.19 + aa * 0.5, dd );
          float fade = 1.0 - smoothstep( 0.25, 0.8, aa );
          herbeMix *= 1.0 - mix( 0.36, strip, fade );
        }
        diffuseColor.rgb *= mix( nu, herbeCol, herbeMix ) * mk.g;
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.82, 0.88, 0.94 ), givre * ( 0.3 + 0.45 * mk.r ) );
      `);
  };

  const geo = new PlaneGeometry(lx, lz, d.nx - 1, d.nz - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate((BORNES.maxX + BORNES.minX) / 2, 0, (BORNES.maxZ + BORNES.minZ) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hauteurTerrain(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, herbe, givre };
}

export { celluleDe };
