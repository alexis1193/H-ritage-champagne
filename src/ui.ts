import { LIEUX, pointArrivee, type Lieu } from './world/lieux';
import { dessinerCarte } from './minicarte';
import { CARTE } from './cartes/chargeur';

const $ = <T extends HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Élément manquant : ${id}`);
  return e as T;
};

/** Interface par-dessus le monde 3D : barre, mini-carte, bouton d'action, panneaux, notifications. */
export class Interface {
  private readonly mini = $<HTMLCanvasElement>('minicarte');
  private readonly carteCanvas = $<HTMLCanvasElement>('carte-canvas');
  private readonly elPanneau = $('panneau');
  private readonly carte = $('carte');
  private readonly action = $('action-conteneur');
  private lieuAction: Lieu | null = null;
  private timerNotif = 0;
  /** Vrai quand un panneau est ouvert : le jeu est en pause, le monde reste visible. */
  enPause = false;
  surAller: ((l: Lieu) => void) | null = null;
  surOuverture: (() => void) | null = null;
  /** Le joueur appuie sur le bouton d'action près d'un lieu. */
  surAction: ((l: Lieu) => void) | null = null;
  surFinMois: (() => void) | null = null;
  /** Entrées du menu (texte, action ; null = bientôt). */
  entreesMenu: [string, (() => void) | null][] = [];
  private rendu: ((corps: HTMLElement) => void) | null = null;

  constructor(private readonly joueur: { x: number; z: number; cap: number }) {
    $('btn-menu').addEventListener('click', () => this.ouvrirMenu());
    $('panneau-fermer').addEventListener('click', () => this.fermerTout());
    $('carte-fermer').addEventListener('click', () => this.fermerTout());
    this.mini.addEventListener('click', () => this.ouvrirCarte());
    $('action').addEventListener('click', () => { if (this.lieuAction) this.surAction?.(this.lieuAction); });
    $('btn-fin').addEventListener('click', () => this.surFinMois?.());
    const liste = $('carte-lieux');
    for (const l of LIEUX) {
      const b = document.createElement('button');
      b.textContent = `${l.icone} ${l.court}`;
      b.addEventListener('click', () => { this.fermerTout(); this.surAller?.(l); });
      liste.appendChild(b);
    }
    const titre = document.querySelector('#carte h2');
    if (titre) titre.textContent = `${CARTE.nom} (${CARTE.sousTitre.split(',')[0]})`;
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

  /** Ouvre un panneau (latéral en paysage, tiroir en portrait) ; le jeu est en pause. `rendu` peut être rappelé pour rafraîchir. */
  panneau(titre: string, rendu: (corps: HTMLElement) => void): void {
    this.carte.hidden = true;
    this.ouvrir();
    this.rendu = rendu;
    $('panneau-titre').textContent = titre;
    this.elPanneau.hidden = false;
    this.dessinerPanneau();
  }

  private dessinerPanneau(): void {
    const corps = $('panneau-corps');
    const haut = this.elPanneau.scrollTop;
    corps.replaceChildren();
    this.rendu?.(corps);
    this.elPanneau.scrollTop = haut;
  }

  rafraichirPanneau(): void { if (!this.elPanneau.hidden) this.dessinerPanneau(); }

  /** Barre du haut : date, jours de travail restants, trésorerie. */
  majBarre(date: string, jours: number, tresorerie: number): void {
    $('date').textContent = date;
    $('jours').textContent = `⚒ ${String(jours).replace('.', ',')} j`;
    const t = $('tresorerie');
    t.textContent = `${Math.round(tresorerie).toLocaleString('fr-FR')} €`;
    t.classList.toggle('negatif', tresorerie < 0);
  }

  ouvrirMenu(): void {
    this.panneau('Menu', (corps) => {
      for (const [t, fn] of this.entreesMenu) {
        const b = document.createElement('button');
        b.textContent = t;
        b.addEventListener('click', fn ?? (() => this.notifier(`${t.slice(3)} : bientôt disponible.`)));
        corps.appendChild(b);
      }
      const p = document.createElement('p');
      p.textContent = 'Le jeu est en pause tant que ce panneau est ouvert.';
      corps.appendChild(p);
    });
  }

  ouvrirCarte(): void {
    this.fermerTout();
    this.ouvrir();
    this.carte.hidden = false;
    const paysage = window.innerWidth > window.innerHeight;
    const w = paysage ? Math.min(window.innerWidth * 0.45, (window.innerHeight - 70) * 0.78) : Math.min(window.innerWidth - 28, (window.innerHeight * 0.55) * 0.78);
    dessinerCarte(this.carteCanvas, this.joueur, Math.max(220, w));
  }

  fermerTout(): void {
    this.rendu = null;
    this.elPanneau.hidden = true;
    this.carte.hidden = true;
    this.enPause = false;
  }

  mettreAJourMini(): void {
    dessinerCarte(this.mini, this.joueur, Math.round(Math.min(96, window.innerWidth * 0.26)));
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
