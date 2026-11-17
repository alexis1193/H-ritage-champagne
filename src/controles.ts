/**
 * Contrôles tactiles et clavier.
 * - Joystick dynamique : apparaît sous le pouce gauche (quart bas gauche), invisible au repos.
 * - Glisser ailleurs : tourner la caméra. Pincer : zoomer. Double tap : recentrer derrière le personnage.
 */
export class Controles {
  yaw = 0;
  pitch = 0.8;
  distance = 60;
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

  constructor(zone: HTMLElement, private readonly joy: HTMLElement, private readonly pouce: HTMLElement) {
    // Doigts : événements tactiles natifs (les plus fiables sur téléphone).
    const liste = (e: TouchEvent, f: (id: number, x: number, y: number) => void): void => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) f(t.identifier, t.clientX, t.clientY);
    };
    const opts = { passive: false } as const;
    zone.addEventListener('touchstart', (e) => liste(e, this.bas), opts);
    zone.addEventListener('touchmove', (e) => liste(e, this.deplacer), opts);
    zone.addEventListener('touchend', (e) => liste(e, this.haut), opts);
    zone.addEventListener('touchcancel', (e) => liste(e, this.haut), opts);
    // Souris et stylet (ordinateur) : événements pointeur ; les doigts sont ignorés ici pour ne pas compter deux fois.
    const MOUSE = -1;
    zone.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') { zone.setPointerCapture(e.pointerId); this.bas(MOUSE, e.clientX, e.clientY); } });
    zone.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') this.deplacer(MOUSE, e.clientX, e.clientY); });
    const finSouris = (e: PointerEvent): void => { if (e.pointerType !== 'touch') this.haut(MOUSE, e.clientX, e.clientY); };
    zone.addEventListener('pointerup', finSouris);
    zone.addEventListener('pointercancel', finSouris);
    zone.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomer(e.deltaY * 0.03); }, { passive: false });
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.clavier.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.clavier.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.clavier.clear(); this.relacher(); });
  }

  private zoomer(delta: number): void {
    this.distance = Math.min(260, Math.max(10, this.distance + delta));
  }

  private dansZoneJoystick(x: number, y: number): boolean {
    return x < window.innerWidth * 0.5 && y > window.innerHeight * 0.5;
  }

  private readonly bas = (id: number, x: number, y: number): void => {
    if (!this.actif) return;
    const role = this.joyId === null && this.dansZoneJoystick(x, y) ? 'joy' : 'cam';
    this.touches.set(id, { x, y, role });
    if (role === 'joy') {
      this.joyId = id;
      this.joyOrigine = { x, y };
      this.joy.style.transform = `translate(${x - this.RAYON}px, ${y - this.RAYON}px)`;
      this.joy.classList.add('visible');
      this.pouce.style.transform = 'translate(0px, 0px)';
    } else {
      const now = performance.now();
      const d = this.dernierTap;
      if (now - d.t < 320 && Math.hypot(x - d.x, y - d.y) < 30) {
        this.surRecentrer?.();
        this.dernierTap = { t: 0, x: 0, y: 0 };
      } else {
        this.dernierTap = { t: now, x, y };
      }
      this.pincement = this.distanceDoigts();
    }
  };

  private distanceDoigts(): number {
    const cams = [...this.touches.values()].filter((t) => t.role === 'cam');
    if (cams.length < 2) return 0;
    return Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y);
  }

  private readonly deplacer = (id: number, x: number, y: number): void => {
    const t = this.touches.get(id);
    if (!t || !this.actif) return;
    const dx = x - t.x;
    const dy = y - t.y;
    t.x = x; t.y = y;
    if (t.role === 'joy') {
      let vx = x - this.joyOrigine.x;
      let vy = y - this.joyOrigine.y;
      const n = Math.hypot(vx, vy);
      if (n > this.RAYON) { vx = (vx / n) * this.RAYON; vy = (vy / n) * this.RAYON; }
      this.pouce.style.transform = `translate(${vx}px, ${vy}px)`;
      this.entree.x = vx / this.RAYON;
      this.entree.y = -vy / this.RAYON;
    } else {
      const doigts = this.distanceDoigts();
      if (doigts > 0 && this.pincement > 0) {
        this.zoomer((this.pincement - doigts) * 0.08);
        this.pincement = doigts;
      } else if ([...this.touches.values()].filter((v) => v.role === 'cam').length === 1) {
        this.yaw -= dx * 0.006;
        this.pitch = Math.min(1.15, Math.max(0.2, this.pitch + dy * 0.004));
      }
    }
  };

  private readonly haut = (id: number, _x: number, _y: number): void => {
    const t = this.touches.get(id);
    this.touches.delete(id);
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
