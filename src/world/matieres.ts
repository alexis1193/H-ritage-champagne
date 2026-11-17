import { LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';

/** Vraies textures photo (ambientCG, licence CC0), réduites à 512 px. Chaque matière : couleur + relief (normales). */
export interface Matiere { couleur: Texture; relief: Texture }
export type NomMatiere = 'platre' | 'tuile' | 'ardoise' | 'pierre' | 'asphalte' | 'herbe';
export type Matieres = Record<NomMatiere, Matiere>;

const NOMS: NomMatiere[] = ['platre', 'tuile', 'ardoise', 'pierre', 'asphalte', 'herbe'];

export async function chargerMatieres(anisotropie: number): Promise<Matieres> {
  const base = import.meta.env.BASE_URL;
  const l = new TextureLoader();
  const charger = async (fichier: string, srgb: boolean): Promise<Texture> => {
    const t = await l.loadAsync(`${base}textures/${fichier}`);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    t.anisotropy = anisotropie;
    t.minFilter = LinearMipmapLinearFilter;
    return t;
  };
  const out = {} as Matieres;
  await Promise.all(NOMS.map(async (n) => {
    const [couleur, relief] = await Promise.all([charger(`${n}.jpg`, true), charger(`${n}_n.jpg`, false)]);
    out[n] = { couleur, relief };
  }));
  return out;
}
