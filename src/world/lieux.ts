import type { DonneesCarte } from '../cartes/types';

/** Lieux du jeu sur la carte réelle. Aucune règle de jeu ici : seulement la géographie. */

export interface Lieu {
  id: string;
  nom: string;
  court: string;
  icone: string;
  x: number;
  z: number;
  /** Point d'arrivée à pied (déplacement rapide). */
  ax: number;
  az: number;
  rayon: number; // distance à laquelle le bouton d'action apparaît
  collision: number; // rayon d'obstacle rond (bâtiments inventés) ; 0 = voir les contours réels
  batiment?: number;
  fictif?: boolean;
  parcelle?: boolean;
}

export interface Parcelle {
  id: string;
  nom: string;
  lieuDit: string;
  cepage: 'chardonnay' | 'pinot noir' | 'meunier';
  ha: number;
  role: string;
  centre: [number, number];
  coins: [number, number][];
}

export interface Chemin { points: [number, number][]; largeur: number; classe: 'r' | 'e' | 'c'; nom: string }

export const LIEUX: Lieu[] = [];
export const PARCELLES: Record<string, Parcelle> = {};
export const CHEMINS: Chemin[] = [];

const paires = (a: number[]): [number, number][] => {
  const r: [number, number][] = [];
  for (let i = 0; i + 1 < a.length; i += 2) r.push([a[i], a[i + 1]]);
  return r;
};

export function installerLieux(d: DonneesCarte): void {
  LIEUX.length = 0;
  for (const l of d.lieux) LIEUX.push({ ...l });
  for (const k of Object.keys(PARCELLES)) delete PARCELLES[k];
  for (const p of d.parcelles) {
    PARCELLES[p.id] = { id: p.id, nom: p.nom, lieuDit: p.lieuDit, cepage: p.cepage, ha: p.ha, role: p.role, centre: [p.c[0], p.c[1]], coins: p.coins.map((c) => [c[0], c[1]] as [number, number]) };
  }
  CHEMINS.length = 0;
  for (const r of d.routes) CHEMINS.push({ points: paires(r.p), largeur: r.w, classe: r.c, nom: r.nom });
}

/** Point où l'on arrive quand on se déplace rapidement vers un lieu. */
export function pointArrivee(l: Lieu): { x: number; z: number } {
  return { x: l.ax, z: l.az };
}
