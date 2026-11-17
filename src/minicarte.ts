import { LIEUX, PARCELLES, VIGNES_VOISINS, CHEMINS } from './world/lieux';
import { BORNES } from './world/terrain';

/** Dessine la carte du village (mini-carte et carte plein écran). */
export function dessinerCarte(cv: HTMLCanvasElement, joueur: { x: number; z: number; cap: number }, largeurCss: number, surbrillance?: string): void {
  const ratio = (BORNES.maxX - BORNES.minX) / (BORNES.maxZ - BORNES.minZ);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = largeurCss;
  const h = largeurCss / ratio;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const c = cv.getContext('2d');
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const u = (x: number) => ((x - BORNES.minX) / (BORNES.maxX - BORNES.minX)) * w;
  const v = (z: number) => ((z - BORNES.minZ) / (BORNES.maxZ - BORNES.minZ)) * h;
  const bande = (z0: number, z1: number, col: string) => { c.fillStyle = col; c.fillRect(0, v(z0), w, v(z1) - v(z0)); };
  bande(BORNES.minZ, -62, '#6f7a55'); // forêt
  bande(-62, 14, '#b9b389'); // coteau
  bande(14, 48, '#d9cfa8'); // village
  bande(48, BORNES.maxZ, '#6f9fb3'); // la Marne
  const rc = (r: { xMin: number; xMax: number; zMin: number; zMax: number }, col: string) => {
    c.fillStyle = col; c.fillRect(u(r.xMin), v(r.zMin), u(r.xMax) - u(r.xMin), v(r.zMax) - v(r.zMin));
  };
  VIGNES_VOISINS.forEach((r) => rc(r, '#8a8a5a'));
  Object.values(PARCELLES).forEach((p) => rc(p.rect, '#5b7a3a'));
  c.lineCap = 'round';
  for (const ch of CHEMINS) {
    c.strokeStyle = ch.largeur > 3 ? '#8f8b84' : '#f4efdf';
    c.lineWidth = Math.max(1, (ch.largeur / (BORNES.maxX - BORNES.minX)) * w * 1.6);
    c.beginPath();
    ch.points.forEach(([x, z], i) => (i ? c.lineTo(u(x), v(z)) : c.moveTo(u(x), v(z))));
    c.stroke();
  }
  const grand = w > 200;
  const etiquettes = w > 460;
  for (const l of LIEUX) {
    const sel = l.id === surbrillance;
    c.fillStyle = sel ? '#ffd24a' : l.collision ? '#a8573b' : 'rgba(0,0,0,0)';
    if (l.collision || sel) {
      c.beginPath(); c.arc(u(l.x), v(l.z), (grand ? 5 : 2.6) + (sel ? 2 : 0), 0, 7); c.fill();
    }
    if (etiquettes && l.collision > 0) { c.font = '600 12px system-ui'; c.fillStyle = '#2b2118'; c.textAlign = 'center'; c.fillText(l.court, u(l.x), v(l.z) - 8); }
  }
  // flèche du joueur
  c.save();
  c.translate(u(joueur.x), v(joueur.z));
  c.rotate(-joueur.cap + Math.PI);
  c.fillStyle = '#1f5fbf'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
  const s = grand ? 7 : 4.5;
  c.beginPath(); c.moveTo(0, -s * 1.3); c.lineTo(s, s); c.lineTo(0, s * 0.5); c.lineTo(-s, s); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
