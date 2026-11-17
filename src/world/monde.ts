import {
  Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshStandardMaterial, PlaneGeometry, Scene, type WebGLRenderer,
} from 'three';
import { BORNES } from './terrain';
import { construireArbres, construireBatiments, obstacles, pointsArbres } from './construction';
import { construireSol } from './sol';
import { construireVignes } from './vigne';
import { creerCiel, DIRECTION_SOLEIL } from './ciel';
import { reliefEau } from './textures';

export interface Monde {
  soleil: DirectionalLight;
  obstacles: { x: number; z: number; r: number }[];
  /** Applique l'aspect d'un mois (0 = janvier … 11 = décembre). */
  mois: (m: number) => void;
  /** Animations légères (eau). */
  animer: (t: number) => void;
}

const BRUME = '#c9d4d6';
// couleur de l'herbe selon le mois
const HERBE = ['#8d9262', '#8d9262', '#8f9a58', '#78a548', '#6c9f3c', '#6f9440', '#7d9040', '#808a44', '#7f8a4a', '#8a8450', '#8a8450', '#8d9262'];

export function construireMonde(scene: Scene, renderer: WebGLRenderer, tailleOmbre: number): Monde {
  scene.fog = new Fog(BRUME, 110, 360);
  creerCiel(renderer, scene);

  scene.add(new HemisphereLight('#dfe9f2', '#6b6244', 0.3));
  const soleil = new DirectionalLight('#ffe9c8', 2.4);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(tailleOmbre, tailleOmbre);
  const cam = soleil.shadow.camera;
  cam.left = -48; cam.right = 48; cam.top = 48; cam.bottom = -48; cam.near = 1; cam.far = 220;
  soleil.shadow.bias = -0.0004;
  soleil.shadow.normalBias = 0.06;
  soleil.position.copy(DIRECTION_SOLEIL).multiplyScalar(100);
  scene.add(soleil, soleil.target);

  const obs = obstacles();
  const sol = construireSol(obs, pointsArbres(), Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  scene.add(sol.mesh);
  const vignes = construireVignes();
  scene.add(vignes.groupe);
  const arbres = construireArbres();
  scene.add(arbres.groupe);
  scene.add(construireBatiments());

  const eau = reliefEau();
  eau.repeat.set(40, 4);
  const marne = new Mesh(
    new PlaneGeometry(BORNES.maxX - BORNES.minX, 24),
    new MeshStandardMaterial({ color: '#3f6f80', roughness: 0.12, metalness: 0.1, normalMap: eau, envMapIntensity: 1.4 }),
  );
  marne.rotation.x = -Math.PI / 2;
  marne.position.set(0, -1.6, 60);
  scene.add(marne);

  return {
    soleil,
    obstacles: obs,
    mois: (m) => { sol.herbe.value.set(HERBE[m]); vignes.saison(m); arbres.saison(m); },
    animer: (t) => { eau.offset.set(t * 0.004, t * 0.006); },
  };
}

export const COULEUR_BRUME = new Color(BRUME);
