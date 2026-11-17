import {
  BoxGeometry, CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry,
} from 'three';
import { BORNES, hauteurTerrain } from './world/terrain';
import type { Obstacles } from './world/collision';

/** Personnage jouable : un vigneron articulé (tête, torse, bras, jambes) avec cycle de marche. L'étape 7 pourra le remplacer par un modèle scanné. */
export class Joueur {
  readonly groupe = new Group();
  x = 0;
  z = 0;
  cap = Math.PI; // direction regardée (0 = vers le sud, π = vers le nord)
  vitesse = 5.5;
  private temps = 0;
  private enMarche = false;
  private phase = 0;
  private readonly corps = new Group();
  private readonly bras: [Group, Group] = [new Group(), new Group()];
  private readonly jambes: [Group, Group] = [new Group(), new Group()];
  private readonly torse: Mesh;

  constructor() {
    const m = (c: string, r = 0.85): MeshStandardMaterial => new MeshStandardMaterial({ color: c, roughness: r });
    const veste = m('#2b4a6b'); const pantalon = m('#5b4e3c'); const peau = m('#e0b08c', 0.7); const cheveux = m('#4a3524'); const chaussures = m('#2a211a');
    const chemise = m('#cfc6b0');
    // torse
    this.torse = new Mesh(new CapsuleGeometry(0.2, 0.42, 4, 10), veste);
    this.torse.scale.set(1.15, 1, 0.8); this.torse.position.y = 1.28;
    const col = new Mesh(new CylinderGeometry(0.11, 0.13, 0.12, 10), chemise); col.position.y = 1.62;
    const tete = new Mesh(new SphereGeometry(0.135, 14, 12), peau); tete.position.y = 1.76; tete.scale.set(0.95, 1.1, 1);
    const coiffe = new Mesh(new SphereGeometry(0.14, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cheveux); coiffe.position.y = 1.79; coiffe.rotation.x = -0.15;
    const bassin = new Mesh(new CapsuleGeometry(0.17, 0.12, 4, 10), pantalon); bassin.rotation.z = Math.PI / 2; bassin.position.y = 0.98; bassin.scale.set(1, 1, 0.9);
    this.corps.add(this.torse, col, tete, coiffe, bassin);
    // bras : épaule en pivot, bras + avant-bras
    for (const [i, s] of [[0, -1], [1, 1]] as const) {
      const bras = this.bras[i]; bras.position.set(s * 0.27, 1.5, 0);
      const haut = new Mesh(new CapsuleGeometry(0.055, 0.26, 4, 8), veste); haut.position.y = -0.17;
      const avant = new Mesh(new CapsuleGeometry(0.048, 0.24, 4, 8), veste); avant.position.y = -0.46;
      const main = new Mesh(new SphereGeometry(0.05, 8, 8), peau); main.position.y = -0.64;
      bras.add(haut, avant, main); this.corps.add(bras);
    }
    // jambes : hanche en pivot
    for (const [i, s] of [[0, -1], [1, 1]] as const) {
      const jambe = this.jambes[i]; jambe.position.set(s * 0.1, 0.95, 0);
      const cuisse = new Mesh(new CapsuleGeometry(0.075, 0.32, 4, 8), pantalon); cuisse.position.y = -0.22;
      const mollet = new Mesh(new CapsuleGeometry(0.063, 0.3, 4, 8), pantalon); mollet.position.y = -0.58;
      const pied = new Mesh(new BoxGeometry(0.11, 0.08, 0.26), chaussures); pied.position.set(0, -0.86, 0.05);
      jambe.add(cuisse, mollet, pied); this.corps.add(jambe);
    }
    this.groupe.add(this.corps);
    this.groupe.traverse((n) => { n.castShadow = true; });
    this.placer(this.x, this.z);
  }

  placer(x: number, z: number): void {
    this.x = x; this.z = z;
    this.groupe.position.set(x, hauteurTerrain(x, z), z);
  }

  /** dx, dz : direction voulue (norme 0 à 1). */
  mettreAJour(dt: number, dx: number, dz: number, obstacles: Obstacles): void {
    const ox = this.x; const oz = this.z;
    const force = Math.hypot(dx, dz);
    this.enMarche = force > 0.05;
    if (this.enMarche) {
      this.x += dx * this.vitesse * dt;
      this.z += dz * this.vitesse * dt;
      const voulu = Math.atan2(dx, dz);
      let diff = voulu - this.cap;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.cap += diff * Math.min(1, dt * 12);
      this.phase += dt * (5 + force * 5);
    }
    const p = { x: this.x, z: this.z };
    obstacles.contrainte?.(ox, oz, p);
    obstacles.resoudre(p);
    this.x = Math.min(BORNES.maxX - 5, Math.max(BORNES.minX + 5, p.x));
    this.z = Math.min(BORNES.maxZ - 5, Math.max(BORNES.minZ + 5, p.z));
    this.temps += dt;
    // animation : balancier des bras et des jambes, léger rebond, respiration à l'arrêt
    const k = this.enMarche ? Math.min(1, force * 1.4) : 0;
    const s = Math.sin(this.phase);
    this.jambes[0].rotation.x = s * 0.75 * k; this.jambes[1].rotation.x = -s * 0.75 * k;
    this.bras[0].rotation.x = -s * 0.6 * k; this.bras[1].rotation.x = s * 0.6 * k;
    this.torse.rotation.y = s * 0.12 * k;
    this.corps.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * k + (this.enMarche ? 0 : Math.sin(this.temps * 1.6) * 0.004);
    this.groupe.position.set(this.x, hauteurTerrain(this.x, this.z), this.z);
    this.groupe.rotation.y = this.cap;
  }
}
