import { describe, it, expect } from 'vitest';
import { neuve, allerAu, sansMeteo } from './aide';
import { demandeDirecte, ventesDirectes, genererOffres, accepterOffre, offreRealisable, prixOffre, signerContrat, vendreSurLattes, inscrireConcours, resultatConcours, fixerPrixPublic } from '../../src/sim/commerce';
import { investir } from '../../src/sim/finance';
import { finDuMois } from '../../src/sim/mois';

describe('vente directe', () => {
  it('demande = base × saison × (26/prix)^1,8 × (0,7 + qualité moyenne/200) ; base 30 sans marque', () => {
    const p = neuve(); // qualité 55, janvier : saison 0,6
    expect(demandeDirecte(p, 26, 0)).toBe(Math.floor(30 * 0.6 * 1 * (0.7 + 55 / 200)));
    expect(demandeDirecte(p, 52, 0)).toBe(Math.floor(30 * 0.6 * Math.pow(0.5, 1.8) * (0.7 + 55 / 200)));
  });
  it('avec marque : 50 + 10 × réputation (valeurs réglables) ; +140 boutique, +260 caveau ; décembre ×2,8', () => {
    const p = neuve(); p.tresorerie = 500000; investir(p, 'marque');
    const c = p.params.commerce;
    const base = c.baseAvecMarque + c.baseParReputation * p.reputation;
    expect(demandeDirecte(p, 26, 11)).toBe(Math.floor(base * 2.8 * (0.7 + 55 / 200)));
    investir(p, 'boutique'); investir(p, 'caveau');
    expect(demandeDirecte(p, 26, 11)).toBe(Math.floor((base + 140 + 260) * 2.8 * (0.7 + 55 / 200)));
  });
  it('un prix plus haut réduit la demande ; le prix public va de 14 à 60 €', () => {
    const p = neuve();
    expect(demandeDirecte(p, 40, 5)).toBeLessThan(demandeDirecte(p, 20, 5));
    expect(fixerPrixPublic(p, 13).ok).toBe(false); expect(fixerPrixPublic(p, 61).ok).toBe(false); expect(fixerPrixPublic(p, 30).ok).toBe(true);
  });
  it('vend au plus le stock disponible, encaisse prix × quantité', () => {
    const p = neuve(); p.stock[0].n = 5; const t = p.tresorerie;
    const v = ventesDirectes(p);
    expect(v.n).toBeLessThanOrEqual(5); expect(p.tresorerie - t).toBeCloseTo(v.n * 26);
  });
});

describe('offres des clients', () => {
  const avecMarque = () => { const p = neuve(sansMeteo); p.marque = true; return p; };
  it('pas d\'offre sans marque déposée', () => { const p = neuve(); p.params.commerce.offresMin = 2; genererOffres(p); expect(p.offres).toHaveLength(0); });
  it('1 à 3 offres par mois, valables 2 mois, seulement de clients dont la réputation est atteinte, une seule offre ouverte par client', () => {
    const p = avecMarque(); p.params.commerce.offresMin = 3; p.params.commerce.offresMax = 3; p.reputation = 100;
    genererOffres(p);
    expect(p.offres).toHaveLength(3);
    expect(new Set(p.offres.map((o) => o.clientId)).size).toBe(3);
    expect(p.offres.every((o) => o.expire === p.moisAbs + 2)).toBe(true);
    const q = avecMarque(); q.params.commerce.offresMin = 3; q.params.commerce.offresMax = 3; q.reputation = 0; genererOffres(q);
    expect(q.offres.every((o) => o.clientId === 'caviste_bruxelles')).toBe(true);
    expect(q.offres.length).toBe(1);
  });
  it('les offres expirent', () => {
    const p = avecMarque(); p.params.commerce.offresMin = 1; p.params.commerce.offresMax = 1; genererOffres(p);
    const n = p.offres.length; expect(n).toBe(1);
    p.moisAbs += 3; genererOffres(p); expect(p.offres.every((o) => o.expire >= p.moisAbs + 1)).toBe(true);
  });
  it('prix final = prix × (0,75 + qualité/200) × bonus de cuvée', () => {
    expect(prixOffre(19, 60, 1)).toBeCloseTo(19 * 1.05); expect(prixOffre(19, 60, 1.35)).toBeCloseTo(19 * 1.05 * 1.35);
  });
  it('exigences : dosage (brut), mois (mariages mars-août), qualité minimale', () => {
    const p = avecMarque(); p.offres.push({ id: 1, clientId: 'caviste_bruxelles', qte: 100, expire: 5 });
    p.stock = [{ id: 1, n: 500, qualite: 60, cuvee: 'brut_sans_annee', dosage: 'demi-sec', moisMise: 0 }];
    expect(offreRealisable(p, 1).ok).toBe(false); // demi-sec ≠ brut
    p.stock[0].dosage = 'brut'; expect(offreRealisable(p, 1).ok).toBe(true);
    p.offres.push({ id: 2, clientId: 'mariages', qte: 100, expire: 9 }); // janvier : hors saison
    expect(offreRealisable(p, 2).ok).toBe(false);
    p.offres.push({ id: 3, clientId: 'restaurant_etoile', qte: 60, expire: 9 }); p.stock[0].dosage = 'extra brut'; p.stock[0].qualite = 63;
    expect(offreRealisable(p, 3).ok).toBe(false); p.stock[0].qualite = 64; expect(offreRealisable(p, 3).ok).toBe(true);
  });
  it('accepter : encaisse, retire le stock, change la réputation (+2 caviste ; −4 centrale d\'achat)', () => {
    const p = avecMarque(); p.stock = [{ id: 1, n: 3000, qualite: 60, cuvee: 'brut_sans_annee', dosage: 'brut', moisMise: 0 }];
    p.offres.push({ id: 1, clientId: 'caviste_bruxelles', qte: 200, expire: 5 }, { id: 2, clientId: 'centrale', qte: 1500, expire: 5 });
    const t = p.tresorerie; const r0 = p.reputation;
    expect(accepterOffre(p, 1).ok).toBe(true);
    expect(p.tresorerie - t).toBeCloseTo(200 * 19 * 1.05); expect(p.reputation).toBe(r0 + 2); expect(p.stock[0].n).toBe(2800);
    accepterOffre(p, 2); expect(p.reputation).toBe(Math.max(0, r0 + 2 - 4));
  });
  it('la première vente de bouteilles faites par le joueur est notée (pas les bouteilles de la coopérative)', () => {
    const p = avecMarque(); p.stock = [{ id: 1, n: 5, qualite: 60, cuvee: 'brut_sans_annee', dosage: 'brut', moisMise: -1 }]; ventesDirectes(p);
    expect(p.premiereVenteMois).toBeNull();
    allerAu(p, 5); p.stock = [{ id: 2, n: 200, qualite: 60, cuvee: 'brut_sans_annee', dosage: 'brut', moisMise: 3 }]; ventesDirectes(p);
    expect(p.premiereVenteMois).toBe(p.moisAbs);
  });
});

describe('Maison Delaunay, concours', () => {
  it('contrat de raisins : prix garanti (7,00 à 7,90 €) signé jusqu\'en juillet', () => {
    const p = neuve(); expect(p.prixContratPropose).toBeGreaterThanOrEqual(7); expect(p.prixContratPropose).toBeLessThanOrEqual(7.9);
    expect(signerContrat(p).ok).toBe(true); expect(p.contratPrix).toBe(p.prixContratPropose); expect(signerContrat(p).ok).toBe(false);
    const q = neuve(sansMeteo); allerAu(q, 7); expect(signerContrat(q).ok).toBe(false);
  });
  it('rachat sur lattes : 11 € × (0,75 + qualité/200), sans réputation', () => {
    const p = neuve(); p.lattes.push({ id: 7, n: 1000, qualite: 60, cuvee: 'brut_sans_annee', moisTirage: 0, millesime: null, age: 3 });
    const t = p.tresorerie; vendreSurLattes(p, 7, 400); expect(p.tresorerie - t).toBeCloseTo(400 * 11 * 1.05); expect(p.lattes[0].n).toBe(600);
  });
  it('concours : 400 € en mars ou avril ; en mai or (75+, +8) ou argent (68+, +4)', () => {
    const p = neuve(sansMeteo); expect(inscrireConcours(p).ok).toBe(false);
    allerAu(p, 2); const t = p.tresorerie; expect(inscrireConcours(p).ok).toBe(true); expect(t - p.tresorerie).toBe(400);
    p.stock = [{ id: 1, n: 10, qualite: 75, cuvee: 'brut_sans_annee', dosage: 'brut', moisMise: 0 }]; const r = p.reputation;
    expect(resultatConcours(p)).toBe('or'); expect(p.reputation).toBe(r + 8);
    p.stock[0].qualite = 68; p.reputation = 10; expect(resultatConcours(p)).toBe('argent'); expect(p.reputation).toBe(14);
    p.stock[0].qualite = 67; expect(resultatConcours(p)).toBeNull();
  });
  void finDuMois;
});
