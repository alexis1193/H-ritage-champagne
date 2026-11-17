import { depenser, erreur, exploitees, joursMax, moisCourant, noter, ok, parcelle, travail } from './partie';
import { TRAVAUX } from './params';
import { entre, tirage } from './rng';
import type { Cepage, Mode, ParcelleEtat, Partie, Resultat, TravailDef } from './types';

/** La vigne : travaux du mois, oublis, météo, récolte. Tout est règle de jeu, rien d'affichage. */

export const SYSTEMES = ['guyot', 'cordon', 'chablis', 'vallee_marne'] as const;
export type Systeme = (typeof SYSTEMES)[number];

/** Le système idéal donne +3 de qualité. */
export const systemeIdeal = (c: Cepage): Systeme => (c === 'chardonnay' ? 'chablis' : c === 'pinot noir' ? 'cordon' : 'vallee_marne');
/** Vallée de la Marne est interdit sur les autres cépages ; Guyot et Cordon sont acceptés partout. */
export const systemePermis = (c: Cepage, s: Systeme): boolean => s !== 'vallee_marne' || c === 'meunier';

export interface TravailDu { parcelleId: string; travail: TravailDef; jours: number; coutEquipe: number }

export const joursPour = (t: TravailDef, ha: number): number => Math.round(t.joursHa * ha * 100) / 100;
export const coutEquipePour = (t: TravailDef, ha: number, kg = 0): number => (t.equipeHa ? t.equipeHa * ha : (t.equipeKg ?? 0) * kg);

/** Combien coûte un jour de travail ? Le jour du joueur « vaut » son salaire divisé par ses jours ; l'équipe coûte plus ou moins cher selon le travail. */
export function coutJour(p: Partie): { jourJoueur: number; equipeParJour: Record<string, number> } {
  const out: Record<string, number> = {};
  for (const t of TRAVAUX) if (t.equipeHa) out[t.id] = Math.round(t.equipeHa / t.joursHa);
  return { jourJoueur: Math.round(p.params.charges.salaireMois / p.params.temps.joursParMois), equipeParJour: out };
}

/** Travaux à faire ce mois-ci, parcelle par parcelle. */
export function travauxDus(p: Partie): TravailDu[] {
  const m = moisCourant(p);
  const out: TravailDu[] = [];
  for (const parc of exploitees(p)) {
    for (const t of TRAVAUX) {
      if (!t.mois.includes(m) || parc.faits[t.id]) continue;
      if (t.id === 'vendanges' && (parc.vendangee || parc.recolteKg !== null)) continue;
      const kg = t.id === 'vendanges' ? estimationRecolte(p, parc) : 0;
      out.push({ parcelleId: parc.id, travail: t, jours: joursPour(t, parc.ha), coutEquipe: coutEquipePour(t, parc.ha, kg) });
    }
  }
  return out;
}

/** Qualité des raisins d'une parcelle (cette année). */
export function qualiteRaisins(p: Partie, parc: ParcelleEtat): number {
  const q = p.params.qualite;
  const base = parc.qualiteSouches + parc.bonusTaille + parc.qualiteAjust;
  const sante = Math.max(0, q.santeSeuil - parc.sante) * q.santePenalite;
  return Math.max(0, Math.min(100, base - sante));
}

/** Récolte = hectares × 11 500 kg × effets météo × (0,6 + 0,4 × santé / 100), plafonnée au rendement autorisé. */
export function estimationRecolte(p: Partie, parc: ParcelleEtat): number {
  const r = p.params.rendement;
  const brut = parc.ha * r.baseKgHa * parc.facteurRecolte * (r.santeMini + r.santePart * (parc.sante / 100));
  return Math.round(Math.min(brut, parc.ha * p.plafondHa));
}

export function faireTravail(p: Partie, parcelleId: string, travailId: string, mode: Mode, opts: { systeme?: Systeme } = {}): Resultat {
  const parc = parcelle(p, parcelleId);
  const t = travail(travailId);
  if (!parc || !t) return erreur('Travail ou parcelle inconnus.');
  if (parc.statut !== 'possedee' && parc.statut !== 'louee') return erreur("Cette parcelle n'est pas exploitée par vous.");
  if (!t.mois.includes(moisCourant(p))) return erreur(`${t.nom} : pas la bonne saison.`);
  if (parc.faits[t.id]) return erreur(`${t.nom} est déjà fait ici.`);
  if (t.id === 'vendanges' && parc.vendangee) return erreur('Cette parcelle est déjà vendangée.');
  if (t.id === 'taille') {
    const s = opts.systeme;
    if (!s) return erreur('Choisissez un système de taille.');
    if (!systemePermis(parc.cepage, s)) return erreur('Vallée de la Marne est réservée au meunier.');
  }
  const kg = t.id === 'vendanges' ? estimationRecolte(p, parc) : 0;
  if (mode === 'soi') {
    const j = joursPour(t, parc.ha);
    if (j > p.jours + 1e-9) return erreur(`Il vous manque des jours (${j} nécessaires, ${p.jours} restants).`);
    p.jours = Math.round((p.jours - j) * 100) / 100;
  } else {
    const c = coutEquipePour(t, parc.ha, kg);
    if (t.id === 'vendanges') p.cueilletteAPayer += c; // payé en fin de mois
    else depenser(p, c, 'travaux');
  }
  parc.faits[t.id] = true;
  p.actions++;
  if (t.id === 'taille') {
    parc.systeme = opts.systeme ?? null;
    parc.bonusTaille = opts.systeme === systemeIdeal(parc.cepage) ? p.params.qualite.bonusTailleIdeale : 0;
  }
  if (t.id === 'vendanges') {
    parc.vendangee = true;
    parc.recolteKg = kg;
    const q = qualiteRaisins(p, parc);
    const stock = p.raisins.find((r) => r.cepage === parc.cepage);
    if (stock) { stock.qualite = (stock.qualite * stock.kg + q * kg) / (stock.kg + kg); stock.kg += kg; }
    else p.raisins.push({ cepage: parc.cepage, kg, qualite: q });
    noter(p, `Vendanges de ${parc.nom} : ${kg} kg, qualité ${q.toFixed(0)}.`);
  }
  return ok();
}

/** Fin de mois, étape 1 : pénalités des travaux oubliés. */
export function appliquerOublis(p: Partie, ev: string[]): void {
  const m = moisCourant(p);
  for (const parc of exploitees(p)) {
    for (const t of TRAVAUX) {
      if (!t.mois.includes(m)) continue;
      const echu = t.id === 'protection' ? true : t.echeance === m;
      if (!echu || parc.faits[t.id]) continue;
      parc.oublisAn++;
      const o = t.oubli;
      if (o.recolte) parc.facteurRecolte *= o.recolte;
      if (o.qualite) parc.qualiteAjust += o.qualite;
      if (o.sante) parc.sante = Math.max(0, parc.sante + o.sante);
      if (o.perte) {
        parc.recolteKg = 0; parc.vendangee = true;
        ev.push(`Vendanges oubliées à ${parc.nom} : la récolte est perdue.`);
      } else if (t.id !== 'protection') ev.push(`${t.nom} oublié à ${parc.nom}.`);
    }
  }
}

/** Fin de mois, étape 2 : météo et maladies. */
export function appliquerMeteo(p: Partie, ev: string[]): void {
  const m = moisCourant(p);
  const w = p.params.meteo;
  const parcs = exploitees(p);
  if (m === w.gel.mois && tirage(p, w.gel.proba)) {
    const perte = entre(p, w.gel.min, w.gel.max) * (p.antigel ? w.gel.antigel : 1);
    for (const x of parcs) x.facteurRecolte *= 1 - perte;
    ev.push(`Gel de printemps : récolte −${Math.round(perte * 100)} %${p.antigel ? ' (atténué par la protection antigel)' : ''}.`);
  }
  if (m === w.coulure.mois) {
    if (tirage(p, w.coulure.proba)) {
      const perte = entre(p, w.coulure.min, w.coulure.max);
      for (const x of parcs) x.facteurRecolte *= 1 - perte;
      ev.push(`Coulure à la floraison : récolte −${Math.round(perte * 100)} %.`);
    } else if (tirage(p, w.floraison.proba / (1 - w.coulure.proba))) {
      for (const x of parcs) x.facteurRecolte *= 1 + w.floraison.bonusRecolte;
      p.bonusMillesime += w.floraison.bonusMillesime;
      ev.push('Belle floraison : récolte +5 %.');
    }
  }
  if (m >= w.maladie.moisMin && m <= w.maladie.moisMax) {
    for (const x of parcs) {
      const proba = x.faits.protection ? w.maladie.probaProtege : w.maladie.probaNonProtege;
      if (tirage(p, proba)) {
        x.sante = Math.max(0, x.sante - entre(p, w.maladie.santeMin, w.maladie.santeMax));
        x.facteurRecolte *= 1 - entre(p, w.maladie.recolteMin, w.maladie.recolteMax);
        ev.push(`Mildiou ou oïdium à ${x.nom}${x.faits.protection ? '' : ' (vigne non protégée)'}.`);
      }
    }
  }
  if (w.grele.mois.includes(m) && parcs.length && tirage(p, w.grele.proba)) {
    const x = parcs[Math.floor(entre(p, 0, parcs.length))];
    const perte = entre(p, w.grele.min, w.grele.max);
    x.facteurRecolte *= 1 - perte;
    ev.push(`Grêle sur ${x.nom} : −${Math.round(perte * 100)} % de récolte.`);
  }
  if (m === w.canicule.mois) {
    if (tirage(p, w.canicule.proba)) {
      for (const x of parcs) x.facteurRecolte *= 1 - w.canicule.recolte;
      ev.push('Canicule : récolte −5 %.');
    } else if (tirage(p, w.eteIdeal.proba / (1 - w.canicule.proba))) {
      p.bonusMillesime += w.eteIdeal.bonusMillesime;
      ev.push('Été idéal : un beau millésime se prépare.');
    }
  }
}

/** Nouvelle saison de vigne (janvier). */
export function nouvelleSaison(p: Partie): void {
  const d = p.params.depart;
  for (const x of p.parcelles) {
    x.sante = Math.max(40, Math.min(98, d.santeVigne + (x.qualiteSouches - d.qualiteSouches) * 0.3));
    x.qualiteAjust = 0; x.bonusTaille = 0; x.systeme = null; x.faits = {}; x.oublisAn = 0; x.facteurRecolte = 1; x.recolteKg = null; x.vendangee = false;
  }
  p.bonusMillesime = 0; p.concoursInscrit = false;
}

/** 31 décembre : les souches gagnent 2 points si la vigne a été bien soignée, en perdent 2 sinon. */
export function majSouches(p: Partie): void {
  const q = p.params.qualite;
  for (const x of exploitees(p)) {
    x.qualiteSouches = Math.max(q.souchesMin, Math.min(q.souchesMax, x.qualiteSouches + (x.oublisAn === 0 ? q.souchesPas : -q.souchesPas)));
  }
}

export const joursRestants = (p: Partie): number => Math.min(p.jours, joursMax(p));
