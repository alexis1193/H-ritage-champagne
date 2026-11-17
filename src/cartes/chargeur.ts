import type { DonneesCarte } from './types';
import { definirRelief } from '../world/terrain';
import { installerLieux } from '../world/lieux';

const modules = import.meta.glob('../data/cartes/*.json') as Record<string, () => Promise<{ default: DonneesCarte }>>;

export const CARTE_PAR_DEFAUT = 'hautvillers';
export let CARTE: DonneesCarte;

/** Identifiants des cartes importées (une future carte, comme Épernay, apparaît ici dès que son fichier existe). */
export function cartesDisponibles(): string[] {
  return Object.keys(modules).map((k) => k.replace(/^.*\//, '').replace('.json', ''));
}

export async function chargerCarte(id: string): Promise<DonneesCarte> {
  const m = modules[`../data/cartes/${id}.json`];
  if (!m) throw new Error(`Carte « ${id} » non importée. Lancez : npm run importer -- ${id}`);
  return (await m()).default;
}

/** Rend une carte active : relief, lieux, chemins. Les autres modules lisent CARTE. */
export function installerCarte(d: DonneesCarte): void {
  CARTE = d;
  definirRelief(d);
  installerLieux(d);
}
