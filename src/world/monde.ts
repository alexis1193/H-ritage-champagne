import {
  AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshLambertMaterial, PlaneGeometry, Scene,
} from 'three';
import { BORNES, construireTerrain } from './terrain';
import { construireArbres, construireBatiments, construireChemins, construireVignes, obstacles } from './construction';

export interface Monde { soleil: DirectionalLight; obstacles: { x: number; z: number; r: number }[] }

const BRUME = '#dfdcc6';

export function construireMonde(scene: Scene): Monde {
  scene.background = new Color(BRUME);
  scene.fog = new Fog(BRUME, 110, 330);

  scene.add(new HemisphereLight('#fbf3dc', '#8b8060', 1.05));
  scene.add(new AmbientLight('#ffffff', 0.15));
  const soleil = new DirectionalLight('#ffe3b8', 1.5);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(1024, 1024);
  const cam = soleil.shadow.camera;
  cam.left = -45; cam.right = 45; cam.top = 45; cam.bottom = -45; cam.near = 1; cam.far = 160;
  soleil.shadow.bias = -0.0006;
  scene.add(soleil, soleil.target);

  scene.add(construireTerrain());
  scene.add(construireChemins());
  scene.add(construireVignes());
  scene.add(construireArbres());
  scene.add(construireBatiments());

  const marne = new Mesh(
    new PlaneGeometry(BORNES.maxX - BORNES.minX, 24),
    new MeshLambertMaterial({ color: '#6f9fb3' }),
  );
  marne.rotation.x = -Math.PI / 2;
  marne.position.set(0, -1.6, 60);
  scene.add(marne);

  return { soleil, obstacles: obstacles() };
}
