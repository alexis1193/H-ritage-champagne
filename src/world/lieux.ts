/** Données du village de Saint-Aubin-les-Craies. Aucune règle de jeu ici : seulement la géographie. */

export interface Rect { xMin: number; xMax: number; zMin: number; zMax: number }

export interface Lieu {
  id: string;
  nom: string;
  court: string; // nom court pour le bouton d'action
  icone: string;
  x: number;
  z: number;
  rayon: number; // distance à laquelle le bouton d'action apparaît
  collision: number; // rayon d'obstacle (0 = traversable)
}

export interface Parcelle { id: string; cepage: 'chardonnay' | 'pinot noir' | 'meunier'; ha: number; rect: Rect }

const rect = (xMin: number, xMax: number, zMin: number, zMax: number): Rect => ({ xMin, xMax, zMin, zMax });

/** Les 5 parcelles du joueur (surfaces proportionnelles aux hectares). */
export const PARCELLES: Record<string, Parcelle> = {
  crayeres: { id: 'crayeres', cepage: 'chardonnay', ha: 0.7, rect: rect(-52, -17, -32, -12) },
  mont_benoit: { id: 'mont_benoit', cepage: 'pinot noir', ha: 0.8, rect: rect(-10, 32, -34, -14) },
  hautes_vignes: { id: 'hautes_vignes', cepage: 'meunier', ha: 0.5, rect: rect(38, 64, -30, -10) },
  longues_raies: { id: 'longues_raies', cepage: 'pinot noir', ha: 1, rect: rect(-52, -16, -60, -38) },
  clos_moulin: { id: 'clos_moulin', cepage: 'chardonnay', ha: 0.6, rect: rect(-6, 20, -58, -40) },
};

/** Vignes des voisins (décor). */
export const VIGNES_VOISINS: Rect[] = [rect(72, 104, -36, -8), rect(-104, -70, -40, -10), rect(30, 70, -60, -42), rect(-100, -60, -64, -46)];

const centre = (r: Rect) => ({ x: (r.xMin + r.xMax) / 2, z: (r.zMin + r.zMax) / 2 });
const parc = (id: string, nom: string, court: string) => ({
  id, nom, court, icone: '🍇', ...centre(PARCELLES[id].rect), rayon: 14, collision: 0,
});

export const LIEUX: Lieu[] = [
  { id: 'maison', nom: 'Maison familiale', court: 'Maison', icone: '🏠', x: -4, z: 10, rayon: 9, collision: 5.5 },
  parc('crayeres', 'Les Crayères', 'Les Crayères'),
  parc('mont_benoit', 'Le Mont Benoît', 'Mont Benoît'),
  parc('hautes_vignes', 'Les Hautes Vignes', 'Hautes Vignes'),
  parc('longues_raies', 'Les Longues Raies', 'Longues Raies'),
  parc('clos_moulin', 'Le Clos du Moulin', 'Clos du Moulin'),
  { id: 'pressoir', nom: 'Pressoir', court: 'Pressoir', icone: '⚙️', x: -26, z: 8, rayon: 10, collision: 6 },
  { id: 'cave', nom: 'Cave et cuverie', court: 'Cave', icone: '🍾', x: -48, z: -3, rayon: 10, collision: 6.5 },
  { id: 'chateau', nom: 'Maison Delaunay & Fils', court: 'Château', icone: '🏰', x: 62, z: 12, rayon: 14, collision: 11 },
  { id: 'notaire', nom: 'Notaire et banque', court: 'Notaire', icone: '📜', x: 8, z: 28, rayon: 8, collision: 4.2 },
  { id: 'eglise', nom: 'Église Saint-Vincent', court: 'Église', icone: '⛪', x: 24, z: 20, rayon: 10, collision: 6 },
  { id: 'loge', nom: 'Loge de vigne', court: 'Loge', icone: '🛖', x: 52, z: -34, rayon: 7, collision: 2.4 },
];

/** Point où l'on arrive quand on se déplace rapidement vers un lieu. */
export function pointArrivee(l: Lieu): { x: number; z: number } {
  return l.collision === 0 ? { x: l.x, z: l.z } : { x: l.x, z: l.z + l.collision + 2.5 };
}

export interface Chemin { points: [number, number][]; largeur: number; couleur: string }

const CRAIE = '#efe9d6';
export const CHEMINS: Chemin[] = [
  { largeur: 4.6, couleur: '#8f8b84', points: [[-130, 39], [-60, 37], [0, 36], [60, 38], [130, 41]] }, // route
  { largeur: 2.4, couleur: CRAIE, points: [[-4, 14], [-4, 24], [0, 36]] },
  { largeur: 2.4, couleur: CRAIE, points: [[24, 25], [22, 31], [18, 36]] },
  { largeur: 2.4, couleur: CRAIE, points: [[8, 31], [8, 36]] },
  { largeur: 2.4, couleur: CRAIE, points: [[-26, 12], [-20, 24], [-14, 36]] },
  { largeur: 2.4, couleur: CRAIE, points: [[62, 24], [62, 30], [58, 38]] },
  { largeur: 2.4, couleur: CRAIE, points: [[-48, 4], [-42, 14], [-26, 24]] },
  { largeur: 2.4, couleur: CRAIE, points: [[-4, 6], [-10, -4], [-13.5, -12], [-13.5, -58]] }, // montée vers les vignes
  { largeur: 2.4, couleur: CRAIE, points: [[-13.5, -37], [20, -37], [60, -37]] },
  { largeur: 2.4, couleur: CRAIE, points: [[26, 20], [35, 0], [35, -38]] },
  { largeur: 2.4, couleur: CRAIE, points: [[60, -37], [52, -34.5]] },
];
