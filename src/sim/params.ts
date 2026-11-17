import parametres from '../data/parametres.json';
import travaux from '../data/travaux.json';
import clients from '../data/clients.json';
import cuvees from '../data/cuvees.json';
import dosages from '../data/dosages.json';
import type { ClientDef, CuveeDef, Params, TravailDef } from './types';

/** Les chiffres viennent des fichiers JSON de src/data : on règle le jeu sans toucher au code. */
export const PARAMS = parametres as unknown as Params;
export const TRAVAUX = travaux as unknown as TravailDef[];
export const CLIENTS = clients as unknown as ClientDef[];
export const CUVEES = cuvees as unknown as CuveeDef[];
export const DOSAGES = dosages as { id: string; nom: string; sucre: string }[];

/** Copie profonde modifiable (le simulateur règle les chiffres sans toucher aux fichiers). */
export const copierParams = (p: Params = PARAMS): Params => JSON.parse(JSON.stringify(p)) as Params;
export const MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
