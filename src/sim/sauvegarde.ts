import type { Params, Partie } from './types';

/** Sauvegarde : tout l'état de la partie en texte (le jeu l'écrit dans localStorage). Un code à copier permet de changer d'appareil. */
export const VERSION_SAUVEGARDE = 1;

export function serialiser(p: Partie): string {
  const { params: _params, ...reste } = p;
  void _params;
  return JSON.stringify({ v: VERSION_SAUVEGARDE, paramsVersion: p.params.version, partie: reste });
}

export function deserialiser(texte: string, params: Params): Partie {
  const o = JSON.parse(texte) as { v: number; paramsVersion: number; partie: Omit<Partie, 'params'> };
  if (o.v !== VERSION_SAUVEGARDE) throw new Error('Sauvegarde d\'une version inconnue.');
  return { ...o.partie, params } as Partie;
}

/** Code d'export à copier-coller (texte UTF-8 encodé en base64). */
export function versCode(p: Partie): string {
  return btoa(unescape(encodeURIComponent(serialiser(p))));
}
export function depuisCode(code: string, params: Params): Partie {
  return deserialiser(decodeURIComponent(escape(atob(code.trim()))), params);
}
