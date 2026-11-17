import './style.css';
import { ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { construireMonde } from './world/monde';
import { hauteurTerrain } from './world/terrain';
import { LIEUX, pointArrivee, type Lieu } from './world/lieux';
import { Joueur } from './joueur';
import { Controles } from './controles';
import { Interface } from './ui';
import { DIRECTION_SOLEIL as DIR } from './world/ciel';

const canvas = document.getElementById('monde') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Qualité : écran tactile = plus léger par défaut ; ?qualite=haute ou ?qualite=basse pour forcer.
const tactile = matchMedia('(pointer: coarse)').matches;
const qualite = params.get('qualite') ?? (tactile ? 'moyenne' : 'haute');
const TAILLE_OMBRE = qualite === 'haute' ? 2048 : 1024;
const RATIO_MAX = qualite === 'haute' ? 2 : qualite === 'moyenne' ? 1.5 : 1;
let ratio = Math.min(window.devicePixelRatio, RATIO_MAX);
renderer.setPixelRatio(ratio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping; // couleurs « cinéma », gestion sRGB par défaut
renderer.toneMappingExposure = 0.3;

const scene = new Scene();
const camera = new PerspectiveCamera(55, 1, 0.5, 1500);
const monde = construireMonde(scene, renderer, TAILLE_OMBRE);
const moisInitial = Math.min(11, Math.max(0, Number(params.get('mois') ?? 0) || 0));
monde.mois(moisInitial);
const joueur = new Joueur();
scene.add(joueur.groupe);

const controles = new Controles(
  document.getElementById('zone-tactile') as HTMLElement,
  document.getElementById('joystick') as HTMLElement,
  document.getElementById('pouce') as HTMLElement,
);
controles.yaw = 0; // caméra derrière le personnage, qui regarde vers le nord (coteau)
const ui = new Interface(joueur);

const recentrer = (): void => { controles.yaw = Math.atan2(-Math.sin(joueur.cap), -Math.cos(joueur.cap)); };
controles.surRecentrer = recentrer;
ui.surOuverture = () => controles.relacher();

function allerA(l: Lieu): void {
  const p = pointArrivee(l);
  joueur.placer(p.x, p.z);
  joueur.cap = Math.PI;
  recentrer();
  ui.notifier(`Vous voilà : ${l.nom}.`);
}
ui.surAller = allerA;

function redimensionner(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 62 : 52; // champ plus large en portrait
  camera.updateProjectionMatrix();
  ui.mettreAJourMini();
}
window.addEventListener('resize', redimensionner);
window.addEventListener('orientationchange', redimensionner);
redimensionner();

function lieuProche(): Lieu | null {
  let meilleur: Lieu | null = null;
  let dMin = Infinity;
  for (const l of LIEUX) {
    const d = Math.hypot(joueur.x - l.x, joueur.z - l.z);
    if (d < l.rayon && d < dMin) { meilleur = l; dMin = d; }
  }
  return meilleur;
}

let dernier = performance.now();
let lissee = 0; // cible de caméra lissée
let framesFps = 0;
let tFps = dernier;
let fps = 0;
let tMini = 0;

function boucle(now: number): void {
  requestAnimationFrame(boucle);
  const dt = Math.min(0.05, (now - dernier) / 1000);
  dernier = now;

  if (!ui.enPause) {
    const e = controles.lire();
    // avant = direction regardée par la caméra
    const fx = -Math.sin(controles.yaw);
    const fz = -Math.cos(controles.yaw);
    const dx = fx * e.y + -fz * e.x;
    const dz = fz * e.y + fx * e.x;
    joueur.mettreAJour(dt, dx, dz, monde.obstacles);
    ui.mettreAJourAction(lieuProche());
  }

  const cible = { x: joueur.x, y: hauteurTerrain(joueur.x, joueur.z) + 1.7, z: joueur.z };
  lissee += (cible.y - lissee) * Math.min(1, dt * 6) || 0;
  if (lissee === 0) lissee = cible.y;
  const d = controles.distance;
  const cp = Math.cos(controles.pitch);
  let cx = cible.x + Math.sin(controles.yaw) * cp * d;
  let cz = cible.z + Math.cos(controles.yaw) * cp * d;
  let cy = lissee + Math.sin(controles.pitch) * d;
  cy = Math.max(cy, hauteurTerrain(cx, cz) + 1.5); // la caméra ne passe pas sous le sol
  camera.position.set(cx, cy, cz);
  camera.lookAt(cible.x, lissee, cible.z);
  cx = cible.x; cz = cible.z;

  // Ombres stables : le cadre d'ombre avance par pas d'un texel, sinon elles « nagent » quand on marche.
  const texel = 96 / TAILLE_OMBRE;
  const droite = new Vector3().crossVectors(new Vector3(0, 1, 0), DIR).normalize();
  const haut = new Vector3().crossVectors(DIR, droite).normalize();
  const c = new Vector3(cx, cible.y - 1.7, cz);
  const a = Math.round(c.dot(droite) / texel) * texel - c.dot(droite);
  const b = Math.round(c.dot(haut) / texel) * texel - c.dot(haut);
  c.addScaledVector(droite, a).addScaledVector(haut, b);
  monde.soleil.target.position.copy(c);
  monde.soleil.position.copy(c).addScaledVector(DIR, 100);
  monde.soleil.target.updateMatrixWorld();
  monde.animer(now / 1000);

  renderer.render(scene, camera);

  if (now - tMini > 200) { tMini = now; if (!ui.enPause) ui.mettreAJourMini(); }
  framesFps++;
  if (now - tFps >= 1000) {
    fps = framesFps; framesFps = 0; tFps = now;
    if (fpsEl) fpsEl.textContent = `${fps} i/s · ${qualite} · échelle ${ratio.toFixed(2)}`;
    // Qualité adaptative : si le téléphone peine (< 40 i/s), on réduit la résolution ; s'il a de la marge, on la remonte.
    if (!params.has('fixe') && !ui.enPause && now > 4000) {
      const cible = fps < 40 ? Math.max(0.6, ratio - 0.2) : fps >= 58 ? Math.min(Math.min(devicePixelRatio, RATIO_MAX), ratio + 0.1) : ratio;
      if (cible !== ratio) { ratio = cible; renderer.setPixelRatio(ratio); renderer.setSize(window.innerWidth, window.innerHeight, false); }
    }
  }
}

const fpsEl = new URLSearchParams(location.search).has('debug')
  ? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'fps' }) : null;

requestAnimationFrame(boucle);
document.getElementById('chargement')?.classList.add('fini');

// Outils pour les tests automatiques (captures d'écran).
(window as unknown as { __jeu: unknown }).__jeu = {
  allerA: (id: string) => { const l = LIEUX.find((x) => x.id === id); if (l) allerA(l); },
  etat: () => ({ x: joueur.x, z: joueur.z, fps, pause: ui.enPause }),
  mois: (m: number) => monde.mois(m),
  menu: () => ui.ouvrirMenu(),
  carte: () => ui.ouvrirCarte(),
  fermer: () => ui.fermerTout(),
};
