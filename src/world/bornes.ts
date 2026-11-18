import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { PARCELLES } from './lieux';
import { hauteurTerrain } from './terrain';

/** Piquets colorés autour de chaque parcelle du joueur : vert = possédée, bleu = en fermage, jaune = à louer, gris = à acheter. */
const COULEURS: Record<string, string> = { possedee: '#3ea04a', louee: '#3a7bd5', disponible_fermage: '#e1b12c', disponible_achat: '#9a9a9a' };

export class Bornes {
  readonly groupe = new Group();
  private readonly meshes = new Map<string, InstancedMesh>();

  constructor() {
    for (const parc of Object.values(PARCELLES)) {
      const pts: [number, number][] = [];
      for (let i = 0; i < parc.coins.length; i++) {
        const [ax, az] = parc.coins[i]; const [bx, bz] = parc.coins[(i + 1) % parc.coins.length];
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 12));
        for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
      }
      const im = new InstancedMesh(new BoxGeometry(0.3, 2.2, 0.3), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#222222' }), pts.length);
      const m = new Matrix4();
      pts.forEach(([x, z], i) => im.setMatrixAt(i, m.compose(new Vector3(x, hauteurTerrain(x, z) + 1.1, z), new Quaternion(), new Vector3(1, 1, 1))));
      im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.computeBoundingSphere();
      this.meshes.set(parc.id, im);
      this.groupe.add(im);
    }
  }

  majStatuts(statuts: Record<string, string>): void {
    for (const [id, im] of this.meshes) {
      const c = new Color(COULEURS[statuts[id]] ?? '#ffffff');
      for (let i = 0; i < im.count; i++) im.setColorAt(i, c);
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}
