import { LIEUX, CHEMINS } from './world/lieux';
import { BORNES } from './world/terrain';
import { CARTE } from './cartes/chargeur';

let fond: HTMLCanvasElement | null = null;
let fondL = 0;

/** Fond de carte (forêts, vignes, eau, routes, bâtiments), dessiné une seule fois par taille. */
function fabriquerFond(w: number, h: number, dpr: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d');
  if (!c) return cv;
  c.scale(dpr, dpr);
  const lx = BORNES.maxX - BORNES.minX; const lz = BORNES.maxZ - BORNES.minZ;
  const u = (x: number): number => ((x - BORNES.minX) / lx) * w;
  const v = (z: number): number => ((z - BORNES.minZ) / lz) * h;
  c.fillStyle = '#d9d2b0'; c.fillRect(0, 0, w, h);
  const poly = (p: number[], col: string): void => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < p.length; i += 2) (i ? c.lineTo(u(p[i]), v(p[i + 1])) : c.moveTo(u(p[i]), v(p[i + 1]))); c.closePath(); c.fill(); };
  for (const g of CARTE.vegetation) poly(g.p, g.t === 'v' ? '#b8c474' : g.t === 'h' ? '#5f7f3f' : g.t === 'g' ? '#a8b86a' : '#5d7a42');
  for (const e of CARTE.eau) poly(e.p, '#5a95b5');
  c.lineCap = 'round';
  for (const ch of CHEMINS) {
    if (ch.classe === 'c' && w < 300) continue;
    c.strokeStyle = ch.classe === 'r' ? '#ffffff' : '#ece4cc'; c.lineWidth = Math.max(0.6, (ch.largeur / lx) * w * (ch.classe === 'r' ? 2.4 : 1.6));
    c.beginPath(); ch.points.forEach(([x, z], i) => (i ? c.lineTo(u(x), v(z)) : c.moveTo(u(x), v(z)))); c.stroke();
  }
  for (const b of CARTE.batiments) poly(b.p, '#a8573b');
  return cv;
}

/** Dessine la carte (mini-carte et carte plein écran). */
export function dessinerCarte(cv: HTMLCanvasElement, joueur: { x: number; z: number; cap: number }, largeurCss: number, surbrillance?: string): void {
  const lx = BORNES.maxX - BORNES.minX; const lz = BORNES.maxZ - BORNES.minZ;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = largeurCss; const h = (largeurCss * lz) / lx;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const c = cv.getContext('2d');
  if (!c) return;
  if (!fond || fondL !== Math.round(w)) { fond = fabriquerFond(w, h, dpr); fondL = Math.round(w); }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(fond, 0, 0, cv.width, cv.height);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const u = (x: number): number => ((x - BORNES.minX) / lx) * w;
  const v = (z: number): number => ((z - BORNES.minZ) / lz) * h;
  const grand = w > 200;
  for (const l of LIEUX) {
    const sel = l.id === surbrillance;
    c.fillStyle = sel ? '#ffd24a' : l.parcelle ? '#2d7a2d' : '#7a2d2d';
    c.strokeStyle = '#fff'; c.lineWidth = grand ? 1.5 : 1;
    c.beginPath(); c.arc(u(l.x), v(l.z), (grand ? 5 : 2.4) + (sel ? 2 : 0), 0, 7); c.fill(); c.stroke();
    if (grand) { c.font = '600 12px system-ui'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.85)'; c.strokeText(l.court, u(l.x), v(l.z) - 8); c.fillStyle = '#2b2118'; c.fillText(l.court, u(l.x), v(l.z) - 8); }
  }
  c.save();
  c.translate(u(joueur.x), v(joueur.z));
  c.rotate(-joueur.cap + Math.PI);
  c.fillStyle = '#1f5fbf'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
  const s = grand ? 7 : 4.5;
  c.beginPath(); c.moveTo(0, -s * 1.3); c.lineTo(s, s); c.lineTo(0, s * 0.5); c.lineTo(-s, s); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
