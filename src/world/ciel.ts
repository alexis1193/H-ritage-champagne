import { PMREMGenerator, Scene, Vector3, type WebGLRenderer } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/** Direction du soleil (coteaux plein sud : il vient du sud, assez haut). */
export const DIRECTION_SOLEIL = new Vector3(0.38, 0.62, 0.69).normalize();

function faireCiel(): Sky {
  const sky = new Sky();
  sky.scale.setScalar(900);
  const u = sky.material.uniforms;
  u.turbidity.value = 3.2;
  u.rayleigh.value = 1.5;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(DIRECTION_SOLEIL);
  return sky;
}

/** Ciel réaliste + lumière ambiante tirée de ce ciel (calculée une seule fois). */
export function creerCiel(renderer: WebGLRenderer, scene: Scene): void {
  scene.add(faireCiel());
  const pmrem = new PMREMGenerator(renderer);
  const tmp = new Scene();
  tmp.add(faireCiel());
  scene.environment = pmrem.fromScene(tmp, 0, 0.1, 2000).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
}
