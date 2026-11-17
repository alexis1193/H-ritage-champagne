import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, SphereGeometry } from 'three';
import { BORNES, hauteurTerrain } from './world/terrain';
import type { Obstacles } from './world/collision';

/** Personnage jouable (forme simple, remplacée par un vrai modèle animé à l'étape 7). */
export class Joueur {
  readonly groupe = new Group();
  x = 0;
  z = 0;
  cap = Math.PI; // direction regardée (0 = vers le sud, π = vers le nord)
  private temps = 0;
  private enMarche = false;
  vitesse = 7;

  constructor() {
    const veste = new MeshLambertMaterial({ color: '#2f5d8a' });
    const corps = new Mesh(new CylinderGeometry(0.42, 0.5, 1.2, 8), veste);
    corps.position.y = 0.95;
    const tete = new Mesh(new SphereGeometry(0.34, 8, 6), new MeshLambertMaterial({ color: '#e2b48f' }));
    tete.position.y = 1.85;
    const bonnet = new Mesh(new CylinderGeometry(0.3, 0.36, 0.22, 8), new MeshLambertMaterial({ color: '#7a2f2f' }));
    bonnet.position.y = 2.12;
    const jambes = new Mesh(new BoxGeometry(0.7, 0.7, 0.4), new MeshLambertMaterial({ color: '#4a4033' }));
    jambes.position.y = 0.35;
    this.groupe.add(corps, tete, bonnet, jambes);
    this.groupe.traverse((n) => { n.castShadow = true; });
    this.placer(this.x, this.z);
  }

  placer(x: number, z: number): void {
    this.x = x; this.z = z;
    this.groupe.position.set(x, hauteurTerrain(x, z), z);
  }

  /** dx, dz : direction voulue (norme 0 à 1). */
  mettreAJour(dt: number, dx: number, dz: number, obstacles: Obstacles): void {
    const force = Math.hypot(dx, dz);
    this.enMarche = force > 0.05;
    if (this.enMarche) {
      this.x += dx * this.vitesse * dt;
      this.z += dz * this.vitesse * dt;
      const voulu = Math.atan2(dx, dz);
      let diff = voulu - this.cap;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.cap += diff * Math.min(1, dt * 12);
      this.temps += dt * (6 + force * 6);
    }
    const p = { x: this.x, z: this.z };
    obstacles.resoudre(p);
    this.x = Math.min(BORNES.maxX - 5, Math.max(BORNES.minX + 5, p.x));
    this.z = Math.min(BORNES.maxZ - 5, Math.max(BORNES.minZ + 5, p.z));
    this.groupe.position.set(this.x, hauteurTerrain(this.x, this.z) + (this.enMarche ? Math.abs(Math.sin(this.temps)) * 0.12 : 0), this.z);
    this.groupe.rotation.y = this.cap;
  }
}
