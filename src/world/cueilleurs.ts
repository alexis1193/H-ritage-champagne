import { CapsuleGeometry, Color, Euler, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { PARCELLES } from './lieux';
import { hauteurTerrain } from './terrain';
import { angleDeNiveau, celluleDe, ESPACEMENT_RANGS, niveauAngle } from './rangs';
import { dansPoly } from './geom';

/** Cueilleurs en septembre : des silhouettes penchées qui avancent le long des rangs des parcelles exploitées. */
const PAR_PARCELLE = 16;

interface Cueilleur { s0: number; t: number; dx: number; dz: number; phase: number; vitesse: number }

export class Cueilleurs {
  readonly groupe = new Group();
  private readonly corps: InstancedMesh;
  private readonly tetes: InstancedMesh;
  private liste: Cueilleur[] = [];
  private readonly m = new Matrix4(); private readonly q = new Quaternion(); private readonly e = new Euler(); private readonly p = new Vector3(); private readonly s = new Vector3(1.8, 1.8, 1.8);

  constructor() {
    const max = PAR_PARCELLE * 6;
    this.corps = new InstancedMesh(new CapsuleGeometry(0.2, 0.55, 3, 8), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), max);
    this.tetes = new InstancedMesh(new SphereGeometry(0.14, 8, 8), new MeshStandardMaterial({ color: '#e0b08c', roughness: 0.7 }), max);
    const habits = ['#d9382b', '#2f7bd9', '#f0c419', '#ffffff', '#e67e22', '#9b59b6'];
    for (let i = 0; i < max; i++) this.corps.setColorAt(i, new Color(habits[i % habits.length]));
    this.corps.count = 0; this.tetes.count = 0;
    this.corps.frustumCulled = false; this.tetes.frustumCulled = false;
    this.corps.castShadow = this.tetes.castShadow = true;
    this.groupe.add(this.corps, this.tetes);
    this.groupe.visible = false;
  }

  /** Place les cueilleurs sur les parcelles données (liste vide = personne). */
  regler(ids: string[]): void {
    this.liste = [];
    for (const id of ids) {
      const parc = PARCELLES[id];
      if (!parc) continue;
      const pts = new Float32Array(parc.coins.flat());
      const [cx, cz] = parc.centre; const [ci, cj] = celluleDe(cx, cz);
      const th = angleDeNiveau(niveauAngle(ci, cj));
      const dx = Math.cos(th); const dz = Math.sin(th); const nx = -dz; const nz = dx;
      let n = 0; let essais = 0;
      while (n < PAR_PARCELLE && essais++ < 300) {
        const x = cx + (Math.random() - 0.5) * 80; const z = cz + (Math.random() - 0.5) * 80;
        if (!dansPoly(x, z, pts)) continue;
        const t = Math.round((x * nx + z * nz) / ESPACEMENT_RANGS) * ESPACEMENT_RANGS; // l'axe d'un inter-rang
        this.liste.push({ s0: x * dx + z * dz, t, dx, dz, phase: Math.random() * 6.28, vitesse: 0.15 + Math.random() * 0.15 });
        n++;
      }
    }
    const n = Math.min(this.liste.length, this.corps.instanceMatrix.count);
    this.corps.count = n; this.tetes.count = n;
    this.groupe.visible = n > 0;
  }

  mettreAJour(t: number): void {
    if (!this.groupe.visible) return;
    this.liste.forEach((c, i) => {
      if (i >= this.corps.count) return;
      const s = c.s0 + Math.sin(t * c.vitesse + c.phase) * 5; // va-et-vient le long du rang
      const sens = Math.cos(t * c.vitesse + c.phase) >= 0 ? 1 : -1;
      const nx = -c.dz; const nz = c.dx;
      const x = c.t * nx + s * c.dx; const z = c.t * nz + s * c.dz;
      const y = hauteurTerrain(x, z);
      const yaw = Math.atan2(c.dx * sens, c.dz * sens);
      const pliure = 0.55 + Math.sin(t * 2 + c.phase) * 0.12; // le cueilleur se penche et se redresse
      this.q.setFromEuler(this.e.set(pliure, 0, 0)); const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw); qy.multiply(this.q);
      this.corps.setMatrixAt(i, this.m.compose(this.p.set(x, y + 1.45, z), qy, this.s));
      const avant = new Vector3(0, 0, 0.45).applyQuaternion(qy);
      this.tetes.setMatrixAt(i, this.m.compose(this.p.set(x + avant.x * 1.6, y + 1.95, z + avant.z * 1.6), this.q.identity(), this.s));
    });
    this.corps.instanceMatrix.needsUpdate = true; this.tetes.instanceMatrix.needsUpdate = true;
    if (this.corps.instanceColor) this.corps.instanceColor.needsUpdate = true;
  }
}
