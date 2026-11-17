/**
 * Contrôles tactiles et clavier.
 * - Joystick dynamique : apparaît sous le pouce gauche (quart bas gauche), invisible au repos.
 * - Glisser ailleurs : tourner la caméra. Pincer : zoomer. Double tap : recentrer derrière le personnage.
 */
export class Controles {
  yaw = 0;
  pitch = 0.72;
  distance = 36;
  /** Vecteur du joystick : x vers la droite, y vers l'avant (-1 à 1). */
  entree = { x: 0, y: 0 };
  actif = true;
  surRecentrer: (() => void) | null = null;

  private readonly touches = new Map<number, { x: number; y: number; role: 'joy' | 'cam' }>();
  private joyId: number | null = null;
  private joyOrigine = { x: 0, y: 0 };
  private pincement = 0;
  private dernierTap = { t: 0, x: 0, y: 0 };
  private readonly clavier = new Set<string>();
  private readonly RAYON = 55; // joystick de 110 px de diamètre

  constructor(private readonly zone: HTMLElement, private readonly joy: HTMLElement, private readonly pouce: HTMLElement) {
    zone.addEventListener('pointerdown', this.bas);
    zone.addEventListener('pointermove', this.deplacer);
    zone.addEventListener('pointerup', this.haut);
    zone.addEventListener('pointercancel', this.haut);
    zone.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomer(e.deltaY * 0.02); }, { passive: false });
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.clavier.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.clavier.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.clavier.clear());
  }

  private zoomer(delta: number): void {
    this.distance = Math.min(80, Math.max(10, this.distance + delta));
  }

  private dansZoneJoystick(x: number, y: number): boolean {
    return x < window.innerWidth * 0.5 && y > window.innerHeight * 0.5;
  }

  private readonly bas = (e: PointerEvent): void => {
    if (!this.actif) return;
    this.zone.setPointerCapture(e.pointerId);
    const role = this.joyId === null && this.dansZoneJoystick(e.clientX, e.clientY) ? 'joy' : 'cam';
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, role });
    if (role === 'joy') {
      this.joyId = e.pointerId;
      this.joyOrigine = { x: e.clientX, y: e.clientY };
      this.joy.style.transform = `translate(${e.clientX - this.RAYON}px, ${e.clientY - this.RAYON}px)`;
      this.joy.classList.add('visible');
      this.pouce.style.transform = 'translate(0px, 0px)';
    } else {
      const now = performance.now();
      const d = this.dernierTap;
      if (now - d.t < 320 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 30) {
        this.surRecentrer?.();
        this.dernierTap = { t: 0, x: 0, y: 0 };
      } else {
        this.dernierTap = { t: now, x: e.clientX, y: e.clientY };
      }
      this.pincement = this.distanceDoigts();
    }
  };

  private distanceDoigts(): number {
    const cams = [...this.touches.values()].filter((t) => t.role === 'cam');
    if (cams.length < 2) return 0;
    return Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y);
  }

  private readonly deplacer = (e: PointerEvent): void => {
    const t = this.touches.get(e.pointerId);
    if (!t || !this.actif) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY;
    if (t.role === 'joy') {
      let vx = e.clientX - this.joyOrigine.x;
      let vy = e.clientY - this.joyOrigine.y;
      const n = Math.hypot(vx, vy);
      if (n > this.RAYON) { vx = (vx / n) * this.RAYON; vy = (vy / n) * this.RAYON; }
      this.pouce.style.transform = `translate(${vx}px, ${vy}px)`;
      this.entree.x = vx / this.RAYON;
      this.entree.y = -vy / this.RAYON;
    } else {
      const doigts = this.distanceDoigts();
      if (doigts > 0 && this.pincement > 0) {
        this.zoomer((this.pincement - doigts) * 0.05);
        this.pincement = doigts;
      } else if ([...this.touches.values()].filter((x) => x.role === 'cam').length === 1) {
        this.yaw -= dx * 0.006;
        this.pitch = Math.min(1.15, Math.max(0.2, this.pitch + dy * 0.004));
      }
    }
  };

  private readonly haut = (e: PointerEvent): void => {
    const t = this.touches.get(e.pointerId);
    this.touches.delete(e.pointerId);
    if (t?.role === 'joy') {
      this.joyId = null;
      this.entree.x = 0; this.entree.y = 0;
      this.joy.classList.remove('visible');
    }
    this.pincement = this.distanceDoigts();
  };

  /** Annule tout geste en cours (ouverture d'un panneau, par exemple). */
  relacher(): void {
    this.touches.clear();
    this.joyId = null;
    this.entree.x = 0; this.entree.y = 0;
    this.joy.classList.remove('visible');
  }

  /** Entrée combinée joystick + clavier (ZQSD / WASD / flèches). */
  lire(): { x: number; y: number } {
    let kx = 0;
    let ky = 0;
    const k = this.clavier;
    if (k.has('arrowup') || k.has('w') || k.has('z')) ky += 1;
    if (k.has('arrowdown') || k.has('s')) ky -= 1;
    if (k.has('arrowright') || k.has('d')) kx += 1;
    if (k.has('arrowleft') || k.has('a') || k.has('q')) kx -= 1;
    if (k.has('e')) this.yaw -= 0.03;
    if (kx || ky) { const n = Math.hypot(kx, ky); return { x: kx / n, y: ky / n }; }
    return { x: this.entree.x, y: this.entree.y };
  }
}
