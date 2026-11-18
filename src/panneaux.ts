import {
  analyseRentabilite, anneeCourante, coutJour, estimationRecolte, faireTravail, finDuMois, louerParcelle, MOIS_NOMS, moisCourant, parcelle,
  prixRaisinsKg, qualiteRaisins, systemeIdeal, systemePermis, travauxDus, TRAVAUX, vendreRaisins, exploitees, SYSTEMES,
} from './sim';
import type { ParcelleEtat, Partie, Resume, Systeme } from './sim';
import textes from './data/textes.json';
import type { Jeu } from './jeu';
import type { Interface } from './ui';

/** Panneaux de jeu : ils lisent l'état de la simulation et appellent ses actions. Aucune règle ici. */
export interface Contexte {
  jeu: Jeu;
  ui: Interface;
  /** À appeler après toute action : sauvegarde, barre du haut, panneau rafraîchi, décor mis à jour. */
  apres: () => void;
  apresFinDuMois: (r: Resume) => void;
}

const eur = (n: number): string => `${Math.round(n).toLocaleString('fr-FR')} €`;
const NOMS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
export const dateCourte = (p: Partie): string => `${NOMS_COURTS[moisCourant(p)]} ${anneeCourante(p)}`;
const maj = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const T = textes as unknown as {
  mois: { nom: string; titre: string; texte: string }[];
  travaux: Record<string, { nom: string; pourquoi: string }>;
  systemes: Record<string, { nom: string; note: string }>;
  interface: { finMoisAvertissement: string; jourVaut: string };
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', texte = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte) e.textContent = texte;
  return e;
}
interface OptBouton { primaire?: boolean; raison?: string | false }
function bouton(texte: string, fn: () => void, o: OptBouton = {}): HTMLButtonElement {
  const b = el('button', o.primaire ? 'primaire' : '', texte);
  if (o.raison) { b.disabled = true; b.title = o.raison; }
  b.addEventListener('click', fn);
  return b;
}
function jauge(nom: string, valeur: number): HTMLElement {
  const v = Math.max(0, Math.min(100, Math.round(valeur)));
  const d = el('div', 'jauge');
  d.append(el('span', '', nom));
  const b = el('div', 'jauge-barre'); const i = el('i'); i.style.width = `${v}%`; i.className = v >= 70 ? 'bon' : v >= 45 ? 'moyen' : 'bas'; b.append(i);
  d.append(b, el('b', '', String(v)));
  return d;
}

const statutTexte: Record<ParcelleEtat['statut'], string> = {
  possedee: 'vous la possédez', louee: 'en fermage', disponible_fermage: 'à louer en fermage', disponible_achat: 'à acheter',
};
const systemeChoisi = new Map<string, Systeme>();

/** Panneau d'une parcelle : jauges, travaux du mois (moi-même ou équipe), taille, vendanges. */
export function panneauParcelle(ctx: Contexte, id: string): void {
  ctx.ui.panneau(`🍇 ${parcelle(ctx.jeu.partie, id)?.nom ?? 'Parcelle'}`, (corps) => {
    const p = ctx.jeu.partie;
    const parc = parcelle(p, id);
    if (!parc) { corps.append(el('p', '', 'Parcelle inconnue.')); return; }
    corps.append(el('p', 'sous-titre', `${maj(parc.cepage)} · ${String(parc.ha).replace('.', ',')} ha · ${statutTexte[parc.statut]}`));

    if (parc.statut === 'disponible_fermage') {
      corps.append(el('p', '', `Cette parcelle se loue en fermage pour ${eur(p.params.charges.fermageAn)} par an (payé chaque mois). Elle apporte plus de raisin, mais aussi plus de travail et de frais.`));
      corps.append(bouton('Louer cette parcelle', () => { const r = louerParcelle(p, id); if (!r.ok) ctx.ui.notifier(r.erreur ?? 'Impossible.'); else ctx.ui.notifier(`${parc.nom} est à vous en fermage.`); ctx.apres(); }, { primaire: true }));
      return;
    }
    if (parc.statut === 'disponible_achat') {
      corps.append(el('p', '', `Cette parcelle est à vendre pour ${eur(p.params.investissements.achatParcelle)}. L'achat se fait chez le notaire, en général avec un emprunt : cela viendra plus tard dans la partie.`));
      return;
    }

    corps.append(jauge('Santé', parc.sante), jauge('Qualité des raisins', qualiteRaisins(p, parc)), jauge('Qualité des souches', parc.qualiteSouches));
    const mois = moisCourant(p);
    const note = T.mois[mois];
    corps.append(el('h3', '', `Travaux de ${note.nom}`));
    const c = coutJour(p);
    corps.append(el('p', 'aide', `Vous avez ${String(p.jours).replace('.', ',')} jour(s). Un jour de votre travail vaut ${eur(c.jourJoueur)}.`));

    const dus = travauxDus(p).filter((d) => d.parcelleId === id);
    if (!dus.length) corps.append(el('p', '', 'Rien à faire ici ce mois-ci.'));
    for (const d of dus) {
      const t = d.travail; const info = T.travaux[t.id];
      const carte = el('div', 'travail');
      carte.append(el('h4', '', info?.nom ?? t.nom), el('p', 'pourquoi', info?.pourquoi ?? ''));
      let systeme: Systeme | undefined;
      if (t.id === 'taille') {
        systeme = systemeChoisi.get(id) ?? systemeIdeal(parc.cepage);
        const ligne = el('div', 'systemes');
        for (const s of SYSTEMES) {
          const ok = systemePermis(parc.cepage, s);
          const b = bouton(`${T.systemes[s].nom}${s === systemeIdeal(parc.cepage) ? ' ★' : ''}`, () => { systemeChoisi.set(id, s); ctx.ui.rafraichirPanneau(); }, { raison: !ok && 'Interdit sur ce cépage' });
          if (s === systeme) b.classList.add('choisi');
          ligne.append(b);
        }
        carte.append(ligne, el('p', 'aide', `${T.systemes[systeme].note}${systeme === systemeIdeal(parc.cepage) ? '' : ' (★ = système idéal pour ce cépage)'}`));
      }
      const equipe = d.coutEquipe;
      const equipeJour = t.equipeHa ? Math.round(t.equipeHa / t.joursHa) : null;
      const lignes = el('div', 'boutons-ligne');
      const manque = d.jours > p.jours + 1e-9;
      const agir = (mode: 'soi' | 'equipe'): void => {
        const r = faireTravail(p, id, t.id, mode, systeme ? { systeme } : {});
        if (!r.ok) ctx.ui.notifier(r.erreur ?? 'Impossible.');
        else ctx.ui.notifier(`${info?.nom ?? t.nom} : fait${mode === 'equipe' ? ' par l\'équipe' : ''}.`);
        ctx.apres();
      };
      lignes.append(
        bouton(`Moi · ${String(d.jours).replace('.', ',')} j`, () => agir('soi'), { raison: manque && 'Pas assez de jours' }),
        bouton(`Équipe · ${eur(equipe)}`, () => agir('equipe')),
      );
      carte.append(lignes);
      if (equipeJour) carte.append(el('p', 'aide', T.interface.jourVaut.replace('{jour}', String(c.jourJoueur)).replace('{equipe}', String(equipeJour))));
      if (t.id === 'vendanges') carte.append(el('p', 'aide', `Récolte attendue : environ ${Math.round(estimationRecolte(p, parc)).toLocaleString('fr-FR')} kg (plafond de ${p.plafondHa.toLocaleString('fr-FR')} kg/ha). Payé aux cueilleurs en fin de mois : 0,90 € par kg.`));
      corps.append(carte);
    }
    const faits = TRAVAUX.filter((t) => parc.faits[t.id] && t.mois.includes(mois));
    if (faits.length) corps.append(el('p', 'fait', `✓ Déjà fait : ${faits.map((t) => T.travaux[t.id]?.nom ?? t.nom).join(', ')}`));

    if (parc.vendangee && (parc.recolteKg ?? 0) > 0) corps.append(el('p', 'fait', `✓ Vendangé : ${Math.round(parc.recolteKg ?? 0).toLocaleString('fr-FR')} kg`));
    corps.append(...blocRaisins(ctx));
  });
}

/** Raisins cueillis qui attendent : on peut les vendre à la Maison Delaunay (le pressoir arrive à l'étape suivante). */
function blocRaisins(ctx: Contexte): HTMLElement[] {
  const p = ctx.jeu.partie;
  if (!p.raisins.length || ![8, 9].includes(moisCourant(p))) return [];
  const out: HTMLElement[] = [el('h3', '', 'Raisins en attente')];
  out.push(el('p', 'aide', `La Maison Delaunay les rachète ${prixRaisinsKg(p).toFixed(2).replace('.', ',')} € le kg${p.contratPrix !== null ? ' (prix de votre contrat)' : ' (prix du marché)'}. Non vendus ni pressés fin octobre, ils partent 15 % moins cher.`));
  for (const r of p.raisins) {
    out.push(bouton(`Vendre ${Math.round(r.kg).toLocaleString('fr-FR')} kg de ${r.cepage} · ${eur(r.kg * prixRaisinsKg(p))}`, () => {
      const res = vendreRaisins(p, r.cepage, r.kg);
      ctx.ui.notifier(res.ok ? 'Raisins vendus à la Maison Delaunay.' : (res.erreur ?? 'Impossible.'));
      ctx.apres();
    }));
  }
  return out;
}

/** La maison familiale : bureau, tableau de bord. */
export function panneauMaison(ctx: Contexte): void {
  ctx.ui.panneau('🏠 Maison familiale', (corps) => {
    const p = ctx.jeu.partie;
    const c = coutJour(p);
    const ligne = (a: string, b: string): HTMLElement => { const d = el('div', 'ligne'); d.append(el('span', '', a), el('b', '', b)); return d; };
    corps.append(
      ligne('Trésorerie', eur(p.tresorerie)), ligne('Réputation', `${p.reputation} / 100`), ligne('Jours de travail ce mois-ci', String(p.jours).replace('.', ',')),
      ligne('Valeur d\'un jour de votre travail', eur(c.jourJoueur)), ligne('Parcelles exploitées', `${exploitees(p).length} (${exploitees(p).reduce((s, x) => s + x.ha, 0).toFixed(1).replace('.', ',')} ha)`),
    );
    const bouteilles = p.stock.reduce((s, l) => s + l.n, 0) + p.lattes.reduce((s, l) => s + l.n, 0);
    corps.append(ligne('Bouteilles en cave', bouteilles.toLocaleString('fr-FR')));
    if (bouteilles) {
      const a = analyseRentabilite(p);
      corps.append(el('h3', '', 'Combien coûte une bouteille ?'), ligne('Coût de production', `${a.coutDirectMoyen.toFixed(2).replace('.', ',')} €`), ligne('Part des frais fixes', `${a.fraisFixesParBouteille.toFixed(2).replace('.', ',')} €`), ligne('Coût complet (prix plancher)', `${a.coutCompletMoyen.toFixed(2).replace('.', ',')} €`),
        ligne('Raisin d\'une bouteille vendu au négoce', `${a.raisinAuNegoce.toFixed(2).replace('.', ',')} €`));
      corps.append(el('p', 'aide', 'Vendre ses bouteilles sous le coût complet fait perdre de l\'argent. Le réglage des prix et les offres des clients arrivent à l\'étape du commerce.'));
    }
    corps.append(el('p', 'aide', 'Le bureau (clients, marque, missions) sera complété dans les prochaines étapes.'));
  });
}

/** Avant de finir le mois : ce qu'il reste à faire. Les jours non utilisés sont perdus. */
export function panneauFinDuMois(ctx: Contexte): void {
  ctx.ui.panneau('⏭ Fin du mois', (corps) => {
    const p = ctx.jeu.partie;
    const dus = travauxDus(p);
    corps.append(el('p', '', T.interface.finMoisAvertissement));
    if (dus.length) {
      corps.append(el('h3', '', `${dus.length} ${dus.length > 1 ? 'travaux non faits' : 'travail non fait'} ce mois-ci`));
      const ul = el('ul', 'liste');
      for (const d of dus) {
        const parc = parcelle(p, d.parcelleId);
        const urgent = d.travail.echeance === moisCourant(p) || d.travail.echeance === -1;
        const li = el('li', urgent ? 'urgent' : '', `${T.travaux[d.travail.id]?.nom ?? d.travail.nom} — ${parc?.nom ?? ''}${urgent ? ' (dernière chance)' : ''}`);
        ul.append(li);
      }
      corps.append(ul);
    } else corps.append(el('p', 'fait', '✓ Tous les travaux du mois sont faits.'));
    if (p.jours > 0) corps.append(el('p', 'aide', `Il vous reste ${String(p.jours).replace('.', ',')} jour(s) : ils seront perdus.`));
    corps.append(bouton('Terminer le mois', () => {
      const r = finDuMois(p);
      ctx.jeu.sauver();
      ctx.apresFinDuMois(r);
      afficherResume(ctx, r);
    }, { primaire: true }), bouton('Retour au jeu', () => ctx.ui.fermerTout()));
  });
}

/** Écran de résumé mensuel : ce qui s'est passé, les comptes, et ce qui arrive en Champagne le mois suivant. Toujours affiché. */
export function afficherResume(ctx: Contexte, r: Resume): void {
  ctx.ui.panneau(`📋 Fin de ${MOIS_NOMS[r.mois]} ${r.annee}`, (corps) => {
    const p = ctx.jeu.partie;
    corps.append(el('h3', '', 'Ce qui s\'est passé'));
    if (r.evenements.length) { const ul = el('ul', 'liste'); for (const e of r.evenements) ul.append(el('li', '', e)); corps.append(ul); }
    else corps.append(el('p', '', 'Un mois sans surprise.'));
    corps.append(el('h3', '', 'Les comptes du mois'));
    const recettes = Object.entries(r.comptes.recettes).filter(([k]) => k !== 'emprunt');
    const depenses = Object.entries(r.comptes.depenses);
    const tab = el('div', 'comptes');
    for (const [k, v] of recettes) { const d = el('div', 'ligne bon'); d.append(el('span', '', maj(k)), el('b', '', `+ ${eur(v)}`)); tab.append(d); }
    for (const [k, v] of depenses) { const d = el('div', 'ligne'); d.append(el('span', '', maj(k)), el('b', '', `− ${eur(v)}`)); tab.append(d); }
    if (!recettes.length && !depenses.length) tab.append(el('p', '', 'Aucun mouvement.'));
    corps.append(tab);
    const delta = r.tresorerieApres - r.tresorerieAvant;
    const t = el('div', 'ligne total'); t.append(el('span', '', 'Trésorerie'), el('b', delta >= 0 ? 'bon' : 'mauvais', `${eur(r.tresorerieAvant)} → ${eur(r.tresorerieApres)}`));
    corps.append(t);
    if (r.bilan) {
      const b = r.bilan;
      corps.append(el('h3', '', `Bilan ${b.annee}`));
      for (const [a, v] of [['Recettes', eur(b.ca)], ['Dépenses', eur(b.charges)], ['Résultat', eur(b.resultat)], ['Impôts et cotisations', eur(b.impots)], ['Trésorerie au 31 décembre', eur(b.tresorerie)], ['Réputation', `${b.reputation} / 100`]] as const) {
        const d = el('div', 'ligne'); d.append(el('span', '', a), el('b', '', v)); corps.append(d);
      }
    }
    if (p.faillite) {
      corps.append(el('p', 'mauvais', 'La trésorerie est épuisée : la maison est en faillite. Les parents auraient aimé un autre avenir pour ces vignes… Vous pouvez recommencer.'));
      corps.append(bouton('Nouvelle partie', () => { ctx.jeu.nouvelle(); ctx.ui.fermerTout(); location.reload(); }, { primaire: true }));
      return;
    }
    const suivant = moisCourant(p);
    const n = T.mois[suivant];
    corps.append(el('h3', '', `En Champagne en ${n.nom} — ${n.titre}`), el('p', 'texte-mois', n.texte));
    const aFaire = TRAVAUX.filter((x) => x.mois.includes(suivant) && exploitees(p).length).map((x) => T.travaux[x.id]?.nom ?? x.nom);
    if (aFaire.length) corps.append(el('p', 'aide', `Ce qui vous attend : ${aFaire.join(', ')}.`));
    corps.append(bouton(`Commencer ${n.nom}`, () => ctx.ui.fermerTout(), { primaire: true }));
  });
}

/** Sauvegarde : le jeu enregistre tout seul ; on peut aussi copier un code pour changer d'appareil. */
export function panneauSauvegarde(ctx: Contexte): void {
  ctx.ui.panneau('💾 Sauvegarde', (corps) => {
    corps.append(el('p', '', 'Votre partie est enregistrée automatiquement dans ce navigateur après chaque action.'));
    corps.append(el('h3', '', 'Changer d\'appareil'));
    const zone = el('textarea', 'code'); zone.rows = 4; zone.readOnly = true; zone.value = ctx.jeu.exporter();
    corps.append(el('p', 'aide', 'Copiez ce code, puis collez-le sur l\'autre appareil (Sauvegarde → Importer).'), zone);
    corps.append(bouton('Copier le code', () => { zone.select(); try { void navigator.clipboard.writeText(zone.value); ctx.ui.notifier('Code copié.'); } catch { ctx.ui.notifier('Sélectionnez le code et copiez-le.'); } }));
    const entree = el('textarea', 'code'); entree.rows = 3; entree.placeholder = 'Collez ici un code d\'export';
    corps.append(el('h3', '', 'Importer une partie'), entree, bouton('Importer', () => {
      const e = ctx.jeu.importer(entree.value);
      if (e) ctx.ui.notifier(e); else { ctx.ui.notifier('Partie importée.'); location.reload(); }
    }));
    corps.append(el('h3', '', 'Recommencer'), bouton('Nouvelle partie (efface la sauvegarde)', () => {
      if (confirm('Effacer la partie en cours et recommencer ?')) { ctx.jeu.nouvelle(); location.reload(); }
    }));
  });
}

/** Premier écran d'une nouvelle partie. */
export function panneauIntro(ctx: Contexte): void {
  ctx.ui.panneau('🍇 Bienvenue à Hautvillers', (corps) => {
    corps.append(
      el('p', '', 'Vos parents livraient leurs raisins à une grande maison. Vous reprenez leurs 2 hectares de vigne sur les coteaux de la Marne, avec un rêve : en faire votre propre maison de champagne, un geste après l\'autre.'),
      el('h3', '', 'Pour jouer'),
    );
    const ul = el('ul', 'liste');
    for (const t of [
      'Le joystick (à gauche) vous fait marcher ; glissez à droite pour tourner la caméra, pincez pour zoomer.',
      'Près d\'une parcelle, un bouton rond apparaît : touchez-le pour faire les travaux du mois.',
      'Vous avez 10 jours de travail par mois. Une équipe peut faire un travail à votre place, contre de l\'argent.',
      'Quand vous avez fini, touchez « Fin ⏭ » : le mois passe, et vous voyez ce qui s\'est passé.',
      'Chaque geste du vigneron est expliqué au moment de le faire.',
    ]) ul.append(el('li', '', t));
    corps.append(ul, bouton('Commencer', () => { try { localStorage.setItem('heritage-intro-vue', '1'); } catch { /* ignore */ } ctx.ui.fermerTout(); }, { primaire: true }));
  });
}
