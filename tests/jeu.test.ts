import { describe, it, expect } from 'vitest';
import { Jeu } from '../src/jeu';
import { faireTravail, finDuMois, moisCourant } from '../src/sim';
import { dateCourte } from '../src/panneaux';
import textes from '../src/data/textes.json';

describe('état de jeu et sauvegarde', () => {
  it('une nouvelle partie commence en janvier 2027 avec 40 000 €', () => {
    const j = new Jeu(true);
    expect(j.partie.tresorerie).toBe(40000); expect(dateCourte(j.partie)).toBe('Janv. 2027');
  });
  it('exporter puis importer redonne la même partie (changer d\'appareil)', () => {
    const a = new Jeu(true);
    faireTravail(a.partie, 'parcelle1', 'taille', 'equipe', { systeme: 'chablis' });
    finDuMois(a.partie);
    const b = new Jeu(true);
    expect(b.importer(a.exporter())).toBeNull();
    expect(b.partie.moisAbs).toBe(1); expect(b.partie.tresorerie).toBeCloseTo(a.partie.tresorerie);
    expect(moisCourant(b.partie)).toBe(1);
  });
  it('un code invalide est refusé sans casser la partie', () => {
    const j = new Jeu(true); const t = j.partie.tresorerie;
    expect(j.importer('pas un code')).not.toBeNull(); expect(j.partie.tresorerie).toBe(t);
  });
});

describe('textes du jeu', () => {
  it('chaque mois a un texte, et chaque travail est expliqué', () => {
    expect(textes.mois).toHaveLength(12);
    for (const m of textes.mois) { expect(m.texte.length).toBeGreaterThan(80); expect(m.texte.split('. ').length).toBeLessThanOrEqual(4); }
    for (const id of ['taille', 'liage', 'protection', 'ebourgeonnage', 'palissage', 'rognage', 'vendanges', 'labour', 'buttage']) {
      expect((textes.travaux as Record<string, { pourquoi: string }>)[id].pourquoi.length).toBeGreaterThan(20);
    }
    expect(Object.keys(textes.systemes)).toHaveLength(4);
  });
});
