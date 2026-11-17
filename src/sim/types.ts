/** Types de la simulation. Aucun import de Three.js ni du DOM : tout se joue et se teste sans écran. */
export type Cepage = 'chardonnay' | 'pinot noir' | 'meunier';
export type CuveeId = 'brut_sans_annee' | 'blanc_de_blancs' | 'rose' | 'millesime';
export type Dosage = 'brut nature' | 'extra brut' | 'brut' | 'extra dry' | 'sec' | 'demi-sec' | 'doux';
export type Statut = 'possedee' | 'louee' | 'disponible_fermage' | 'disponible_achat';
export type Mode = 'soi' | 'equipe';

export interface TravailDef {
  id: string; nom: string; mois: number[]; echeance: number; joursHa: number; equipeHa?: number; equipeKg?: number;
  oubli: { recolte?: number; qualite?: number; sante?: number; perte?: boolean };
}
export interface ClientDef {
  id: string; nom: string; reputationMin: number; prix: number; qteMin: number; qteMax: number;
  dosages: string[] | null; mois: number[] | null; qualiteMin: number | null; reputation: number;
}
export interface CuveeDef { id: CuveeId; nom: string; minMois: number; prix: number }

export interface Params {
  version: number;
  depart: {
    annee: number; tresorerie: number; reputation: number; santeVigne: number; qualiteSouches: number; cavePlaces: number; cuverieLitres: number;
    stockBouteilles: { n: number; qualite: number; dosage: Dosage }; qualiteVinsClairs: number;
    vinsClairs: { cepage: Cepage; litres: number }[]; successionAnnuite: number; successionAnnees: number; prixPublic: number;
  };
  parcelles: { id: string; nom: string; cepage: Cepage; ha: number; statut: Statut }[];
  temps: { joursParMois: number; joursAvecChef: number };
  charges: {
    salaireMois: number; fraisGenerauxMois: number; chefCultureMois: number; fermageAn: number; interetsEmprunt: number; remboursementAn: number;
    plafondBaseEmprunt: number; plafondParHa: number; tauxImpots: number; decouvertTaux: number; seuilFaillite: number; concours: number;
  };
  investissements: Record<'marque' | 'boutique' | 'caveau' | 'antigel' | 'pressoir' | 'cuverie' | 'cave' | 'gyropalettes' | 'achatParcelle', number>;
  capacites: { cuverieIncrement: number; caveIncrement: number };
  rendement: { baseKgHa: number; plafondMin: number; plafondMax: number; santeMini: number; santePart: number };
  qualite: { bonusTailleIdeale: number; santeSeuil: number; santePenalite: number; souchesMax: number; souchesMin: number; souchesPas: number };
  pressoir: {
    litresCuveeParMarc: number; litresTailleParMarc: number; kgParMarc: number; qualiteCuveeSeule: number; qualiteAvecTaille: number;
    coutCooperativeKg: number; coutFacon: number; litresRougeParKg: number; brade: number;
  };
  raisins: { prixMarcheMin: number; prixMarcheMax: number; prixContratMin: number; prixContratMax: number };
  cave: {
    litresParBouteille: number; coutTirage: number; coutDegorgement: number; coutGyropalette: number; bouteillesParJourRemuage: number;
    bonusAgeParTranche: number; moisParTranche: number; bonusAgeMax: number; bonusTroisCepages: number; seuilCepage: number;
    bonusReserve: number; reserveMin: number; reserveMax: number; malusReserveForte: number; reserveForte: number; bonusMaloRond: number;
    brutNatureSeuil: number; brutNatureMalus: number; moisAssemblage: number[]; moisDegorgement: number[]; moisMalo: number[]; moisPressoir: number[];
  };
  commerce: {
    prixPublicMin: number; prixPublicMax: number; baseSansMarque: number; baseAvecMarque: number; baseParReputation: number;
    bonusBoutique: number; bonusCaveau: number; prixReference: number; exposantPrix: number; saison: number[];
    offresMin: number; offresMax: number; offreDureeMois: number; rachatLattes: number;
    concoursOr: number; concoursArgent: number; concoursReputationOr: number; concoursReputationArgent: number; reputationMission: number;
  };
  meteo: {
    gel: { mois: number; proba: number; min: number; max: number; antigel: number };
    coulure: { mois: number; proba: number; min: number; max: number };
    floraison: { mois: number; proba: number; bonusRecolte: number; bonusMillesime: number };
    maladie: { moisMin: number; moisMax: number; probaProtege: number; probaNonProtege: number; santeMin: number; santeMax: number; recolteMin: number; recolteMax: number };
    grele: { mois: number[]; proba: number; min: number; max: number };
    canicule: { mois: number; proba: number; recolte: number };
    eteIdeal: { mois: number; proba: number; bonusMillesime: number };
    millesime: { bonus: number; qualite: number };
  };
}

export interface ParcelleEtat {
  id: string; nom: string; cepage: Cepage; ha: number; statut: Statut;
  sante: number; qualiteSouches: number; qualiteAjust: number; bonusTaille: number; systeme: string | null;
  faits: Record<string, boolean>; oublisAn: number; facteurRecolte: number; recolteKg: number | null; vendangee: boolean;
}
export interface Raisins { cepage: Cepage; kg: number; qualite: number }
export interface Lot { id: number; cepage: Cepage; litres: number; qualite: number; annee: number; rouge: boolean; style: 'rond' | 'vif' | null; reserve: boolean }
export interface Lattes { id: number; n: number; qualite: number; cuvee: CuveeId; moisTirage: number; millesime: number | null; age: number }
export interface StockPret { id: number; n: number; qualite: number; cuvee: CuveeId; dosage: Dosage; moisMise: number }
export interface Offre { id: number; clientId: string; qte: number; expire: number }

export interface Comptes { recettes: Record<string, number>; depenses: Record<string, number> }
export interface Bilan {
  annee: number; ca: number; charges: number; resultat: number; impots: number; tresorerie: number; reputation: number;
  emprunt: number; patrimoine: number; bouteillesVendues: number; faillite: boolean;
}

export interface Partie {
  params: Params;
  rng: number;
  moisAbs: number; // 0 = janvier de l'an 1
  jours: number;
  tresorerie: number;
  reputation: number;
  marque: boolean; boutique: boolean; caveau: boolean; antigel: boolean; pressoir: boolean; gyropalettes: boolean; chefCulture: boolean;
  cuverieLitres: number; cavePlaces: number;
  parcelles: ParcelleEtat[];
  raisins: Raisins[];
  lots: Lot[];
  lattes: Lattes[];
  stock: StockPret[];
  offres: Offre[];
  prixPublic: number;
  emprunt: number; empruntBase: number;
  successionRestante: number; successionAnnuite: number;
  compteMois: Comptes; compteAn: Comptes;
  resultatAn: number; impotsPayesAn: number; bouteillesVendues: number; bouteillesVenduesTotal: number;
  premiereVenteMois: number | null;
  plafondHa: number; prixMarche: number; prixContratPropose: number; contratPrix: number | null;
  bonusMillesime: number; millesimes: number[]; litresCampagne: number; concoursInscrit: boolean;
  bilans: Bilan[]; faillite: boolean; prochainId: number;
  cueilletteAPayer: number; capex: number; terres: number; actions: number; journal: string[];
}

export interface Resultat { ok: boolean; erreur?: string }
export interface Resume {
  mois: number; annee: number; evenements: string[]; tresorerieAvant: number; tresorerieApres: number;
  comptes: Comptes; bilan: Bilan | null;
}
