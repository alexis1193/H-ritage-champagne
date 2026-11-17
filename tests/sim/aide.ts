import { copierParams } from '../../src/sim/params';
import { creerPartie } from '../../src/sim/partie';
import { finDuMois } from '../../src/sim/mois';
import { moisCourant } from '../../src/sim/partie';
import type { Params, Partie } from '../../src/sim/types';

/** Partie de test : on peut régler les chiffres (probabilités à 0 ou 1, etc.) sans toucher aux fichiers. */
export function neuve(reglage: (p: Params) => void = () => undefined, graine = 1): Partie {
  const params = copierParams();
  reglage(params);
  return creerPartie(params, graine);
}
/** Passe les mois (sans rien faire) jusqu'au mois voulu (0 = janvier). */
export function allerAu(p: Partie, mois: number): void {
  let garde = 0;
  while (moisCourant(p) !== mois && garde++ < 48) finDuMois(p);
}
/** Désactive tous les aléas météo. */
export const sansMeteo = (p: Params): void => {
  p.meteo.gel.proba = 0; p.meteo.coulure.proba = 0; p.meteo.floraison.proba = 0; p.meteo.maladie.probaProtege = 0; p.meteo.maladie.probaNonProtege = 0;
  p.meteo.grele.proba = 0; p.meteo.canicule.proba = 0; p.meteo.eteIdeal.proba = 0;
};
export const parc = (p: Partie, id: string) => p.parcelles.find((x) => x.id === id)!;
