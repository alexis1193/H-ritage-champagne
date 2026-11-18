import { creerPartie, deserialiser, depuisCode, serialiser, versCode, PARAMS } from './sim';
import type { Partie } from './sim';

/** État de la partie en cours + sauvegarde automatique dans le navigateur (localStorage). Aucune règle de jeu ici : tout vient de src/sim. */
const CLE = 'heritage-champagne-sauvegarde-v1';

export class Jeu {
  partie: Partie;

  constructor(nouvelle = false) {
    const sauvee = nouvelle ? null : this.lire();
    this.partie = sauvee ?? creerPartie(PARAMS, (Date.now() & 0x7fffffff) || 1);
  }

  private lire(): Partie | null {
    try {
      const t = localStorage.getItem(CLE);
      return t ? deserialiser(t, PARAMS) : null;
    } catch { return null; }
  }

  /** À appeler après chaque action : la partie est toujours sauvegardée. */
  sauver(): void {
    try { localStorage.setItem(CLE, serialiser(this.partie)); } catch { /* navigation privée : on continue sans sauvegarde */ }
  }

  nouvelle(): void {
    this.partie = creerPartie(PARAMS, (Date.now() & 0x7fffffff) || 1);
    this.sauver();
  }

  exporter(): string { return versCode(this.partie); }

  /** Remplace la partie par celle d'un code d'export. Renvoie un message d'erreur, ou null si tout va bien. */
  importer(code: string): string | null {
    try { this.partie = depuisCode(code, PARAMS); this.sauver(); return null; }
    catch { return "Ce code n'est pas valide."; }
  }
}
