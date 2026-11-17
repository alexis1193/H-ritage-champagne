import { LIEUX, pointArrivee, type Lieu } from './world/lieux';
import { dessinerCarte } from './minicarte';

const $ = <T extends HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Élément manquant : ${id}`);
  return e as T;
};

/** Interface par-dessus le monde 3D : barre, mini-carte, bouton d'action, panneaux, notifications. */
export class Interface {
  private readonly mini = $<HTMLCanvasElement>('minicarte');
  private readonly carteCanvas = $<HTMLCanvasElement>('carte-canvas');
  private readonly panneau = $('panneau');
  private readonly carte = $('carte');
  private readonly action = $('action-conteneur');
  private lieuAction: Lieu | null = null;
  private timerNotif = 0;
  /** Vrai quand un panneau est ouvert : le jeu est en pause, le monde reste visible. */
  enPause = false;
  surAller: ((l: Lieu) => void) | null = null;
  surOuverture: (() => void) | null = null;

  constructor(private readonly joueur: { x: number; z: number; cap: number }) {
    $('btn-menu').addEventListener('click', () => this.ouvrirMenu());
    $('panneau-fermer').addEventListener('click', () => this.fermerTout());
    $('carte-fermer').addEventListener('click', () => this.fermerTout());
    this.mini.addEventListener('click', () => this.ouvrirCarte());
    $('action').addEventListener('click', () => {
      if (this.lieuAction) this.notifier(`${this.lieuAction.nom} : cette activité arrive dans une prochaine étape.`);
    });
    const liste = $('carte-lieux');
    for (const l of LIEUX) {
      const b = document.createElement('button');
      b.textContent = `${l.icone} ${l.court}`;
      b.addEventListener('click', () => { this.fermerTout(); this.surAller?.(l); });
      liste.appendChild(b);
    }
    this.mettreAJourMini();
  }

  notifier(texte: string): void {
    const n = $('notif');
    n.replaceChildren();
    const s = document.createElement('span');
    s.textContent = texte;
    n.appendChild(s);
    clearTimeout(this.timerNotif);
    this.timerNotif = window.setTimeout(() => n.replaceChildren(), 3000);
  }

  private ouvrir(): void { this.enPause = true; this.surOuverture?.(); }

  ouvrirMenu(): void {
    this.fermerTout();
    this.ouvrir();
    const corps = $('panneau-corps');
    corps.replaceChildren();
    const entrees: [string, (() => void) | null][] = [
      ['🗺️ Carte du village', () => { this.fermerTout(); this.ouvrirCarte(); }],
      ['🎯 Missions', null],
      ['📖 Carnet du vigneron', null],
      ['⚙️ Réglages et son', null],
    ];
    for (const [t, fn] of entrees) {
      const b = document.createElement('button');
      b.textContent = t;
      b.addEventListener('click', fn ?? (() => this.notifier(`${t.slice(3)} : bientôt disponible.`)));
      corps.appendChild(b);
    }
    const p = document.createElement('p');
    p.textContent = 'Le jeu est en pause tant que ce panneau est ouvert.';
    corps.appendChild(p);
    this.panneau.hidden = false;
  }

  ouvrirCarte(): void {
    this.fermerTout();
    this.ouvrir();
    this.carte.hidden = false;
    const paysage = window.innerWidth > window.innerHeight;
    const w = paysage ? Math.min(window.innerWidth * 0.55, (window.innerHeight - 70) * 1.5) : window.innerWidth - 28;
    dessinerCarte(this.carteCanvas, this.joueur, Math.max(220, w));
  }

  fermerTout(): void {
    this.panneau.hidden = true;
    this.carte.hidden = true;
    this.enPause = false;
  }

  mettreAJourMini(): void {
    dessinerCarte(this.mini, this.joueur, Math.round(Math.min(130, window.innerWidth * 0.3)));
  }

  /** Affiche le bouton d'action quand le joueur est près d'un lieu. */
  mettreAJourAction(l: Lieu | null): void {
    if (l?.id === this.lieuAction?.id) return;
    this.lieuAction = l;
    this.action.hidden = !l;
    if (l) { $('action-nom').textContent = l.court; $('action-icone').textContent = l.icone; }
  }
}

export { pointArrivee };
