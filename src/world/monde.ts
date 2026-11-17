import {
  DirectionalLight, Fog, HemisphereLight, Mesh, MeshStandardMaterial, Scene, Shape, ShapeGeometry, type WebGLRenderer,
} from 'three';
import type { DonneesCarte } from '../cartes/types';
import { hauteurTerrain } from './terrain';
import { construireSol } from './sol';
import { construireBatiments } from './batiments';
import { construireVignes } from './vigne';
import { construireArbres } from './arbres';
import { creerCiel, DIRECTION_SOLEIL } from './ciel';
import { reliefEau } from './textures';
import { Obstacles } from './collision';
import type { Matieres } from './matieres';

export interface Monde {
  soleil: DirectionalLight;
  obstacles: Obstacles;
  /** Applique l'aspect d'un mois (0 = janvier … 11 = décembre). */
  mois: (m: number) => void;
  /** Charge/décharge ce qui est près du joueur (vignes, arbres) et anime l'eau. */
  mettreAJour: (x: number, z: number, t: number) => void;
  stats: () => string;
}

const BRUME = '#c9d4d6';
const HERBE = ['#8d9262', '#8d9262', '#8f9a58', '#78a548', '#6c9f3c', '#6f9440', '#7d9040', '#808a44', '#7f8a4a', '#8a8450', '#8a8450', '#8d9262'];

export function construireMonde(scene: Scene, renderer: WebGLRenderer, d: DonneesCarte, m: Matieres, tailleOmbre: number): Monde {
  scene.fog = new Fog(BRUME, 220, 1900);
  creerCiel(renderer, scene);

  scene.add(new HemisphereLight('#dfe9f2', '#6b6244', 0.3));
  const soleil = new DirectionalLight('#ffe9c8', 2.4);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(tailleOmbre, tailleOmbre);
  const cam = soleil.shadow.camera;
  cam.left = -48; cam.right = 48; cam.top = 48; cam.bottom = -48; cam.near = 1; cam.far = 260;
  soleil.shadow.bias = -0.0004;
  soleil.shadow.normalBias = 0.06;
  soleil.position.copy(DIRECTION_SOLEIL).multiplyScalar(100);
  scene.add(soleil, soleil.target);

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const obstacles = new Obstacles(d);
  const sol = construireSol(d, m, aniso);
  scene.add(sol.mesh);
  scene.add(construireBatiments(d, m, aniso));
  const vignes = construireVignes(d, obstacles);
  scene.add(vignes.groupe);
  const arbres = construireArbres(d, obstacles, m);
  scene.add(arbres.groupe);
  obstacles.contrainte = vignes.contraindre;

  // eau : plans plats posés au niveau des berges
  const eau = reliefEau();
  eau.repeat.set(0.05, 0.05);
  const matEau = new MeshStandardMaterial({ color: '#3f6f80', roughness: 0.1, metalness: 0.1, normalMap: eau, envMapIntensity: 1.5 });
  for (const e of d.eau) {
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < e.p.length; i += 2) pts.push([e.p[i], e.p[i + 1]]);
    if (pts.length < 3) continue;
    const niveau = pts.reduce((s, [x, z]) => s + hauteurTerrain(x, z), 0) / pts.length;
    const geo = new ShapeGeometry(new Shape(pts.map(([x, z]) => ({ x, y: -z } as never))));
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    const mesh = new Mesh(geo, matEau);
    mesh.position.y = niveau + 0.15;
    scene.add(mesh);
  }

  return {
    soleil,
    obstacles,
    mois: (mm) => { sol.herbe.value.set(HERBE[mm]); vignes.saison(mm); arbres.saison(mm); },
    mettreAJour: (x, z, t) => { vignes.mettreAJour(x, z); arbres.mettreAJour(x, z); eau.offset.set(t * 0.0004, t * 0.0007); },
    stats: () => { const s = vignes.stats(); return `vignes ${s.proches}+${s.moyens} · ${arbres.nombre()} arbres`; },
  };
}
