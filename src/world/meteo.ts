import { BufferAttribute, BufferGeometry, CanvasTexture, Group, Points, PointsMaterial, Vector3 } from 'three';

/** Petit disque flou : les gouttes et les grêlons sont ronds, pas carrés. */
function disque(): CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d');
  if (c) { const g = c.createRadialGradient(16, 16, 2, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); }
  return new CanvasTexture(cv);
}

/** Pluie et grêle : des particules qui tombent autour de la caméra (le givre est dans le sol, voir sol.ts). */
export type TypeMeteo = 'pluie' | 'grele' | null;

const N = 3800; const LARG = 70; const HAUT = 45;

export class Meteo {
  readonly groupe = new Group();
  private readonly pos = new Float32Array(N * 3);
  private readonly geo = new BufferGeometry();
  private readonly mat = new PointsMaterial({ color: '#c9d6e2', size: 3, transparent: true, opacity: 0.65, depthWrite: false, sizeAttenuation: false, map: disque(), alphaTest: 0.02 });
  private readonly points: Points;
  private type: TypeMeteo = null;
  private vitesse = 0;

  constructor() {
    for (let i = 0; i < N; i++) { this.pos[i * 3] = (Math.random() - 0.5) * LARG; this.pos[i * 3 + 1] = Math.random() * HAUT; this.pos[i * 3 + 2] = (Math.random() - 0.5) * LARG; }
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.groupe.add(this.points);
    this.groupe.visible = false;
  }

  regler(t: TypeMeteo): void {
    this.type = t;
    this.groupe.visible = t !== null;
    if (t === 'pluie') { this.mat.color.set('#bcd0e4'); this.mat.size = 4; this.mat.opacity = 0.9; this.vitesse = 26; }
    if (t === 'grele') { this.mat.color.set('#ffffff'); this.mat.size = 9; this.mat.opacity = 1; this.vitesse = 34; }
  }

  actif(): boolean { return this.type !== null; }

  mettreAJour(dt: number, cam: Vector3): void {
    if (!this.type) return;
    for (let i = 0; i < N; i++) {
      let y = this.pos[i * 3 + 1] - this.vitesse * dt;
      if (y < 0) y += HAUT;
      this.pos[i * 3 + 1] = y;
      if (this.type === 'pluie') this.pos[i * 3] -= 2 * dt; // pluie un peu oblique
    }
    this.geo.attributes.position.needsUpdate = true;
    this.groupe.position.set(cam.x, cam.y - HAUT * 0.4, cam.z);
  }
}
