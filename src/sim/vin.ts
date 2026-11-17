import { anneeCourante, cuvee, depenser, encaisser, erreur, lotParId, moisCourant, nouvelId, noter, ok, placesLibres } from './partie';
import type { Cepage, CuveeId, Dosage, Lot, Partie, Resultat } from './types';

/** Du raisin à la bouteille : pressoir, malolactique, assemblage, tirage, vieillissement, dégorgement. */

export const prixRaisinsKg = (p: Partie): number => p.contratPrix ?? p.prixMarche;

/** Vendre du raisin à la Maison Delaunay (prix du contrat s'il est signé, sinon prix du marché). */
export function vendreRaisins(p: Partie, cepage: Cepage, kg: number, bradage = 0): Resultat {
  const s = p.raisins.find((r) => r.cepage === cepage);
  if (!s || kg <= 0 || kg > s.kg + 1e-6) return erreur('Pas assez de raisin.');
  const m = moisCourant(p);
  if (!p.params.cave.moisPressoir.includes(m)) return erreur('Ce n\'est pas la saison de vendre du raisin.');
  s.kg -= kg;
  if (s.kg < 1e-6) p.raisins = p.raisins.filter((r) => r !== s);
  encaisser(p, kg * prixRaisinsKg(p) * (1 - bradage), 'raisins');
  p.actions++;
  return ok();
}

export interface OptionsPresse { garderTaille?: boolean; rouge?: boolean }

/** Presser pour soi : 4 000 kg de marc donnent 2 050 L de cuvée + 500 L de taille. */
export function presserRaisins(p: Partie, cepage: Cepage, kg: number, o: OptionsPresse = {}): Resultat {
  const s = p.raisins.find((r) => r.cepage === cepage);
  const c = p.params.pressoir;
  if (!s || kg <= 0 || kg > s.kg + 1e-6) return erreur('Pas assez de raisin.');
  if (!p.params.cave.moisPressoir.includes(moisCourant(p))) return erreur("Ce n'est pas la saison du pressurage.");
  if (o.rouge && cepage === 'chardonnay') return erreur('Le chardonnay est blanc : pas de vin rouge.');
  let litres: number; let qualite = s.qualite;
  if (o.rouge) litres = kg * c.litresRougeParKg;
  else {
    litres = (kg / c.kgParMarc) * c.litresCuveeParMarc;
    if (o.garderTaille) { litres += (kg / c.kgParMarc) * c.litresTailleParMarc; qualite += c.qualiteAvecTaille; } else qualite += c.qualiteCuveeSeule;
  }
  litres = Math.round(litres);
  if (!p.pressoir) depenser(p, kg * c.coutCooperativeKg, 'pressurage');
  const avant = Math.max(0, p.litresCampagne - p.cuverieLitres);
  p.litresCampagne += litres;
  const surplus = Math.max(0, p.litresCampagne - p.cuverieLitres) - avant;
  if (surplus > 0) depenser(p, surplus * c.coutFacon, 'vinification à façon');
  s.kg -= kg;
  if (s.kg < 1e-6) p.raisins = p.raisins.filter((r) => r !== s);
  p.lots.push({ id: nouvelId(p), cepage, litres, qualite: Math.max(0, qualite), annee: anneeCourante(p), rouge: !!o.rouge, style: null, reserve: false });
  noter(p, `Pressé ${kg} kg de ${cepage} : ${litres} L de vin clair.`);
  p.actions++;
  return ok();
}

/** Malolactique d'octobre à décembre : rond (plus doux) ou vif (plus tendu). */
export function choisirMalo(p: Partie, lotId: number, style: 'rond' | 'vif'): Resultat {
  const l = lotParId(p, lotId);
  if (!l) return erreur('Vin clair inconnu.');
  if (!p.params.cave.moisMalo.includes(moisCourant(p))) return erreur('Pas la saison de la malolactique.');
  if (l.style) return erreur('Choix déjà fait.');
  l.style = style;
  if (style === 'rond') l.qualite += p.params.cave.bonusMaloRond;
  p.actions++;
  return ok();
}

export interface PartLot { lotId: number; litres: number }
export interface Apercu {
  ok: boolean; erreur?: string; litres: number; bouteilles: number; qualite: number; cout: number;
  bonus: { troisCepages: number; reserve: number }; partsCepage: Record<string, number>; partReserve: number; millesime: number | null;
}

/** Aperçu d'un assemblage : qualité attendue, nombre de bouteilles, coût. Ne change rien. */
export function apercuAssemblage(p: Partie, parts: PartLot[], cuveeId: CuveeId): Apercu {
  const a: Apercu = { ok: false, litres: 0, bouteilles: 0, qualite: 0, cout: 0, bonus: { troisCepages: 0, reserve: 0 }, partsCepage: {}, partReserve: 0, millesime: null };
  const c = p.params.cave;
  let total = 0; let somme = 0; let reserve = 0; let rouge = 0;
  const annees = new Set<number>(); const cepages: Record<string, number> = {};
  for (const x of parts) {
    const l = lotParId(p, x.lotId);
    if (!l) { a.erreur = 'Vin clair inconnu.'; return a; }
    if (x.litres <= 0 || x.litres > l.litres + 1e-6) { a.erreur = 'Volume impossible.'; return a; }
    total += x.litres; somme += x.litres * l.qualite;
    if (l.reserve) reserve += x.litres;
    if (l.rouge) rouge += x.litres;
    annees.add(l.annee);
    cepages[l.cepage] = (cepages[l.cepage] ?? 0) + x.litres;
  }
  if (total <= 0) { a.erreur = 'Aucun vin choisi.'; return a; }
  a.litres = total; a.partReserve = reserve / total;
  for (const k of Object.keys(cepages)) a.partsCepage[k] = cepages[k] / total;
  if (Object.values(a.partsCepage).filter((x) => x >= c.seuilCepage).length >= 3) a.bonus.troisCepages = c.bonusTroisCepages;
  if (a.partReserve > c.reserveForte) a.bonus.reserve = c.malusReserveForte;
  else if (a.partReserve >= c.reserveMin && a.partReserve <= c.reserveMax) a.bonus.reserve = c.bonusReserve;
  a.qualite = Math.max(0, Math.min(100, somme / total + a.bonus.troisCepages + a.bonus.reserve));
  a.bouteilles = Math.floor(total / c.litresParBouteille);
  a.cout = a.bouteilles * c.coutTirage;
  if (cuveeId === 'blanc_de_blancs') {
    const blanc = parts.every((x) => { const l = lotParId(p, x.lotId); return l && l.cepage === 'chardonnay' && !l.rouge; });
    if (!blanc) { a.erreur = 'Un blanc de blancs est 100 % chardonnay (vin blanc).'; return a; }
  }
  if (cuveeId === 'rose' && rouge / total < 0.15 - 1e-9) { a.erreur = 'Un rosé d\'assemblage contient au moins 15 % de vin rouge (pinot noir).'; return a; }
  if (cuveeId === 'millesime') {
    if (annees.size !== 1 || reserve > 0) { a.erreur = 'Un millésimé vient d\'une seule année, sans vin de réserve.'; return a; }
    const an = [...annees][0];
    if (!p.millesimes.includes(an)) { a.erreur = `${an} n'a pas été déclarée année exceptionnelle.`; return a; }
    a.millesime = an;
  }
  a.ok = true;
  return a;
}

/** Tirage (janvier à juin) : la liqueur de tirage lance la prise de mousse, les bouteilles partent sur lattes. */
export function tirer(p: Partie, parts: PartLot[], cuveeId: CuveeId): Resultat & { lattesId?: number } {
  if (!p.params.cave.moisAssemblage.includes(moisCourant(p))) return erreur("L'assemblage et le tirage se font de janvier à juin.");
  const a = apercuAssemblage(p, parts, cuveeId);
  if (!a.ok) return erreur(a.erreur ?? 'Assemblage impossible.');
  if (a.bouteilles <= 0) return erreur('Volume trop faible.');
  if (a.bouteilles > placesLibres(p)) return erreur(`La cave manque de place (${placesLibres(p)} libres, ${a.bouteilles} nécessaires).`);
  for (const x of parts) {
    const l = lotParId(p, x.lotId);
    if (l) l.litres -= x.litres;
  }
  p.lots = p.lots.filter((l) => l.litres > 1e-6);
  depenser(p, a.cout, 'tirage');
  const id = nouvelId(p);
  p.lattes.push({ id, n: a.bouteilles, qualite: a.qualite, cuvee: cuveeId, moisTirage: p.moisAbs, millesime: a.millesime, age: 0 });
  noter(p, `Tirage : ${a.bouteilles} bouteilles de ${cuvee(cuveeId)?.nom ?? cuveeId}, qualité ${a.qualite.toFixed(0)}.`);
  p.actions++;
  return { ok: true, lattesId: id };
}

/** Fin juin : les vins clairs restants partent en réserve. */
export function versLaReserve(p: Partie): number {
  let n = 0;
  for (const l of p.lots) if (!l.reserve) { l.reserve = true; n += l.litres; }
  return n;
}

export const vieillir = (p: Partie): void => { for (const l of p.lattes) l.age++; };

export const bonusAge = (p: Partie, ageMois: number, min: number): number => {
  const c = p.params.cave;
  return Math.min(c.bonusAgeMax, Math.floor(Math.max(0, ageMois - min) / c.moisParTranche) * c.bonusAgeParTranche);
};

/** Dégorgement et dosage : le col est gelé, le dépôt expulsé, puis on dose. 1,10 € par bouteille. */
export function degorger(p: Partie, lattesId: number, n: number, dosage: Dosage): Resultat {
  const l = p.lattes.find((x) => x.id === lattesId);
  const c = p.params.cave;
  if (!l || n <= 0 || n > l.n) return erreur('Lot ou quantité invalide.');
  if (!c.moisDegorgement.includes(moisCourant(p))) return erreur('On dégorge en juillet-août et en novembre-décembre.');
  const min = cuvee(l.cuvee)?.minMois ?? 15;
  if (l.age < min) return erreur(`Trop jeune : ${l.age} mois sur lattes, ${min} au minimum.`);
  if (p.gyropalettes) depenser(p, n * c.coutGyropalette, 'remuage');
  else {
    const j = Math.ceil((n / c.bouteillesParJourRemuage) * 100) / 100;
    if (j > p.jours + 1e-9) return erreur(`Remuage à la main : ${j} jours nécessaires, ${p.jours} restants.`);
    p.jours = Math.round((p.jours - j) * 100) / 100;
  }
  depenser(p, n * c.coutDegorgement, 'dégorgement');
  let q = l.qualite + bonusAge(p, l.age, min);
  if (dosage === 'brut nature' && q < c.brutNatureSeuil) q += c.brutNatureMalus;
  l.n -= n;
  if (l.n === 0) p.lattes = p.lattes.filter((x) => x !== l);
  p.stock.push({ id: nouvelId(p), n, qualite: Math.max(0, Math.min(100, q)), cuvee: l.cuvee, dosage, moisMise: p.moisAbs });
  noter(p, `Dégorgé ${n} bouteilles (${dosage}), qualité ${q.toFixed(0)}.`);
  p.actions++;
  return ok();
}

export type { Lot };
