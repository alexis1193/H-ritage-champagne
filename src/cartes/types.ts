/** Format d'une carte réelle produite par scripts/importer-carte.mjs (coordonnées en mètres, x vers l'est, z vers le sud). */
export interface DonneesCarte {
  id: string;
  nom: string;
  sousTitre: string;
  source: string;
  centre: { lat: number; lon: number };
  bornes: { minX: number; maxX: number; minZ: number; maxZ: number };
  pas: number;
  nx: number;
  nz: number;
  altitudeMin: number;
  /** Altitudes en dixièmes de mètre au-dessus de altitudeMin, Int16 petit-boutiste encodé en base64. */
  relief: string;
  batiments: { p: number[]; h: number; u: string; n: string; e: number; t: string }[];
  routes: { p: number[]; w: number; c: 'r' | 'e' | 'c'; nom: string }[];
  vegetation: { t: string; p: number[] }[];
  eau: { p: number[]; nat: string }[];
  cours: { nom: string; p: number[] }[];
  pois: { nom: string; nat: string; x: number; z: number }[];
  lieuxDits: { nom: string; x: number; z: number }[];
  lieux: {
    id: string; nom: string; court: string; icone: string; x: number; z: number; ax: number; az: number;
    rayon: number; collision: number; batiment?: number; fictif?: boolean; parcelle?: boolean;
  }[];
  parcelles: { id: string; nom: string; lieuDit: string; cepage: 'chardonnay' | 'pinot noir' | 'meunier'; ha: number; role: string; c: number[]; k: number; coins: number[][] }[];
  rangs: { espacement: number; niveauxAngle: number };
}
