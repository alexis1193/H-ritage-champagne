// Importe une carte réelle (relief + bâtiments + routes + eau + vignes + bois + noms) depuis les données ouvertes de l'IGN
// et produit src/data/cartes/<id>.json que le jeu lit directement (aucun réseau pendant le jeu).
// Usage : node scripts/importer-carte.mjs hautvillers
// Sources : IGN BD TOPO® et RGE ALTI® via la Géoplateforme (Licence Ouverte Etalab 2.0). Voir docs/CREDITS.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const id = process.argv[2];
if (!id) { console.error('Usage : node scripts/importer-carte.mjs <id>'); process.exit(1); }
const cfg = JSON.parse(readFileSync(`cartes/${id}.json`, 'utf8'));
const UA = 'heritage-champagne-jeu-educatif/0.1';
const cache = `donnees-brutes/${id}`;
mkdirSync(cache, { recursive: true });

// ---- projection locale en mètres : x vers l'est, z vers le sud (le nord est -z)
const { lat: lat0, lon: lon0 } = cfg.centre;
const MX = 111320 * Math.cos((lat0 * Math.PI) / 180);
const MZ = 110574;
const proj = ([lon, lat]) => [(lon - lon0) * MX, -(lat - lat0) * MZ];
const F = cfg.fenetre;
const bornes = { minX: -F.ouest, maxX: F.est, minZ: -F.nord, maxZ: F.sud };
const marge = 60;
const lonMin = lon0 + (bornes.minX - marge) / MX, lonMax = lon0 + (bornes.maxX + marge) / MX;
const latMax = lat0 - (bornes.minZ - marge) / MZ, latMin = lat0 - (bornes.maxZ + marge) / MZ;
const BBOX = `${latMin},${lonMin},${latMax},${lonMax}`;

async function telecharger(url, fichier, binaire = false) {
  const chemin = `${cache}/${fichier}`;
  if (existsSync(chemin)) return binaire ? readFileSync(chemin) : JSON.parse(readFileSync(chemin, 'utf8'));
  for (let essai = 1; essai <= 4; essai++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(chemin, buf);
      return binaire ? buf : JSON.parse(buf.toString('utf8'));
    } catch (e) { console.warn(`  essai ${essai} : ${e.message}`); await new Promise((r) => setTimeout(r, 2000 * essai)); }
  }
  throw new Error(`Échec : ${url}`);
}
const wfs = (couche, fichier) => telecharger(
  `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${couche}&BBOX=${BBOX},urn:ogc:def:crs:EPSG::4326&outputFormat=application/json&srsName=EPSG:4326&count=20000`, fichier);

// ---- géométrie
const anneaux = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : []);
const lignes = (g) => (!g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
function simplifier(pts, tol) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  let dmax = 0, imax = 0;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / L;
    if (d > dmax) { dmax = d; imax = i; }
  }
  if (dmax <= tol) return [a, b];
  return [...simplifier(pts.slice(0, imax + 1), tol).slice(0, -1), ...simplifier(pts.slice(imax), tol)];
}
const arrondi = (pts) => pts.flatMap(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
const dansFenetre = (pts) => pts.some(([x, z]) => x > bornes.minX - 40 && x < bornes.maxX + 40 && z > bornes.minZ - 40 && z < bornes.maxZ + 40);
const aire = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; s += x1 * z2 - x2 * z1; } return Math.abs(s) / 2; };
const centroide = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
function dansPoly(x, z, p) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > z) !== (p[j][1] > z) && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) d = !d;
  }
  return d;
}

// ---- relief (RGE ALTI, grille régulière en lon/lat = grille régulière en mètres)
const pas = cfg.pasRelief;
const nx = Math.round((bornes.maxX - bornes.minX) / pas) + 1;
const nz = Math.round((bornes.maxZ - bornes.minZ) / pas) + 1;
const lonA = lon0 + bornes.minX / MX, lonB = lon0 + bornes.maxX / MX;
const latA = lat0 - bornes.minZ / MZ, latB = lat0 - bornes.maxZ / MZ; // latA = nord
console.log(`Relief ${nx}×${nz} points (pas ${pas} m)…`);
const bil = await telecharger(
  `https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE&STYLES=&CRS=EPSG:4326&BBOX=${latB},${lonA},${latA},${lonB}&WIDTH=${nx}&HEIGHT=${nz}&FORMAT=image/x-bil;bits=32`,
  'relief.bil', true);
const alt = new Float32Array(bil.buffer, bil.byteOffset, nx * nz);
let zmin = 1e9, zmax = -1e9; for (const v of alt) { if (v > -100) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); } }
console.log(`  altitudes ${zmin} à ${zmax} m`);
const Z0 = Math.floor(zmin) - 1;
const hauteurs = new Int16Array(nx * nz);
for (let i = 0; i < alt.length; i++) hauteurs[i] = Math.round((Math.max(alt[i], zmin) - Z0) * 10); // dixièmes de mètre au-dessus de Z0
const hAt = (x, z) => {
  const fx = Math.min(nx - 1.001, Math.max(0, (x - bornes.minX) / pas)), fz = Math.min(nz - 1.001, Math.max(0, (z - bornes.minZ) / pas));
  const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  const g = (a, b) => hauteurs[b * nx + a] / 10;
  return (g(ix, iz) * (1 - tx) + g(ix + 1, iz) * tx) * (1 - tz) + (g(ix, iz + 1) * (1 - tx) + g(ix + 1, iz + 1) * tx) * tz;
};

// ---- couches vectorielles
console.log('Bâtiments…'); const jb = await wfs('BDTOPO_V3:batiment', 'batiments.json');
console.log('Routes…'); const jr = await wfs('BDTOPO_V3:troncon_de_route', 'routes.json');
console.log('Végétation…'); const jv = await wfs('BDTOPO_V3:zone_de_vegetation', 'vegetation.json');
console.log('Eau…'); const jh = await wfs('BDTOPO_V3:surface_hydrographique', 'hydro.json');
const jc = await wfs('BDTOPO_V3:cours_d_eau', 'cours.json');
console.log('Noms de lieux…'); const jt = await wfs('BDTOPO_V3:toponymie', 'toponymie.json'); const jl = await wfs('BDTOPO_V3:lieu_dit_non_habite', 'lieuxdits.json');

const USAGE = { 'Résidentiel': 'r', 'Agricole': 'a', 'Commercial et services': 'c', 'Industriel': 'i', 'Religieux': 'e', 'Sportif': 's', 'Annexe': 'x' };
const batiments = [];
for (const f of jb.features) for (const a of anneaux(f.geometry)) {
  const p = a.map(proj); if (!dansFenetre(p)) continue;
  const q = simplifier(p.slice(0, -1), 0.4); if (q.length < 3) continue;
  const pr = f.properties;
  batiments.push({ p: arrondi(q), h: Math.round((pr.hauteur ?? 0) * 10) / 10, u: USAGE[pr.usage_1] ?? 'o', n: pr.nature ?? '', e: pr.nombre_d_etages ?? 0, t: pr.materiaux_de_la_toiture ?? '' });
}
const CLASSES = { 'Autoroute': 6, 'Route à 2 chaussées': 7, 'Route à 1 chaussée': 5, 'Route empierrée': 4, 'Chemin': 3, 'Rond-point': 5, 'Bac ou liaison maritime': 0, 'Escalier': 1.5, 'Piste cyclable': 2, 'Sentier': 1.5, 'Type autoroutier': 7 };
const routes = [];
for (const f of jr.features) {
  const pr = f.properties; if (pr.position_par_rapport_au_sol && /^-/.test(String(pr.position_par_rapport_au_sol))) continue;
  const larg = CLASSES[pr.nature] ?? 4;
  if (!larg) continue;
  for (const l of lignes(f.geometry)) {
    const p = l.map(proj); if (!dansFenetre(p)) continue;
    routes.push({ p: arrondi(simplifier(p, 0.8)), w: pr.largeur_de_chaussee > 0 ? Math.max(larg * 0.7, pr.largeur_de_chaussee) : larg, c: pr.nature === 'Sentier' || pr.nature === 'Chemin' || pr.nature === 'Escalier' ? 'c' : pr.nature === 'Route empierrée' ? 'e' : 'r', nom: pr.nom_1_gauche || pr.nom_1_droite || '' });
  }
}
const NAT = { 'Vigne': 'v', 'Bois': 'b', 'Forêt fermée de feuillus': 'f', 'Forêt fermée mixte': 'm', 'Forêt fermée de conifères': 'k', 'Peupleraie': 'p', 'Haie': 'h', 'Lande ligneuse': 'l', 'Forêt ouverte': 'o', 'Verger': 'g' };
const vegetation = [];
for (const f of jv.features) {
  const t = NAT[f.properties.nature]; if (!t) continue;
  for (const a of anneaux(f.geometry)) {
    const p = a.map(proj); if (!dansFenetre(p)) continue;
    const q = simplifier(p.slice(0, -1), t === 'h' ? 0.8 : 1.5); if (q.length < 3) continue;
    vegetation.push({ t, p: arrondi(q) });
  }
}
const eau = [];
for (const f of jh.features) for (const a of anneaux(f.geometry)) {
  const p = a.map(proj); if (!dansFenetre(p)) continue;
  const q = simplifier(p.slice(0, -1), 1.5); if (q.length < 3) continue;
  eau.push({ p: arrondi(q), nat: f.properties.nature ?? '' });
}
const cours = [];
for (const f of jc.features) for (const l of lignes(f.geometry)) {
  const p = l.map(proj); if (!dansFenetre(p)) continue;
  cours.push({ nom: f.properties.toponyme ?? '', p: arrondi(simplifier(p, 1.5)) });
}
const lieuxDits = jl.features.filter((f) => f.geometry?.type === 'Point').map((f) => ({ nom: f.properties.toponyme, xz: proj(f.geometry.coordinates) }))
  .filter((l) => l.xz[0] > bornes.minX && l.xz[0] < bornes.maxX && l.xz[1] > bornes.minZ && l.xz[1] < bornes.maxZ);

const POI = ['Culte chrétien', 'Mairie', 'Espace public', 'Office de tourisme', 'Construction', 'Lieu-dit habité'];
const pois = jt.features.filter((f) => f.geometry?.type === 'Point' && POI.includes(f.properties.nature_de_l_objet) && f.properties.graphie_du_toponyme)
  .map((f) => ({ nom: f.properties.graphie_du_toponyme, nat: f.properties.nature_de_l_objet, xz: proj(f.geometry.coordinates) }))
  .filter((l) => l.xz[0] > bornes.minX && l.xz[0] < bornes.maxX && l.xz[1] > bornes.minZ && l.xz[1] < bornes.maxZ);

// ---- aménagements du jeu (positions des lieux, parcelles du joueur)
const polys = (t) => vegetation.filter((v) => v.t === t).map((v) => ({ ...v, pts: v.p.reduce((a, c, i) => (i % 2 ? (a[a.length - 1].push(c), a) : (a.push([c]), a)), []) }));
const vignes = polys('v');
const bats = batiments.map((b, i) => ({ i, pts: b.p.reduce((a, c, k) => (k % 2 ? (a[a.length - 1].push(c), a) : (a.push([c]), a)), []), b }));
for (const b of bats) { b.c = centroide(b.pts); b.aire = aire(b.pts); }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pente = (x, z) => Math.hypot(hAt(x + 5, z) - hAt(x - 5, z), hAt(x, z + 5) - hAt(x, z - 5)) / 10;
const ouvert = (x, z, r) => !bats.some((b) => dist(b.c, [x, z]) < r + Math.sqrt(b.aire)) && !vignes.some((v) => dansPoly(x, z, v.pts)) && !eau.some((e) => dansPoly(x, z, e.p.reduce((a, c, i) => (i % 2 ? (a[a.length - 1].push(c), a) : (a.push([c]), a)), [])));

function batimentProche(cible, filtre, rayon = 400) {
  return bats.filter((b) => filtre(b)).map((b) => ({ b, d: dist(b.c, cible) })).filter((o) => o.d < rayon).sort((a, b) => a.d - b.d)[0]?.b;
}
const rayonBat = (b) => Math.max(4, Math.sqrt(b.aire) / 1.6);
const lieux = [];
const distSeg = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};
const distBat = (x, z) => { // distance (négative = dedans) au bâtiment le plus proche
  let m = 1e9;
  for (const b of bats) {
    if (dist(b.c, [x, z]) > 60) continue;
    const dedans = dansPoly(x, z, b.pts);
    let d = 1e9; for (let i = 0; i < b.pts.length; i++) { const q = b.pts[i], r = b.pts[(i + 1) % b.pts.length]; d = Math.min(d, distSeg(x, z, q[0], q[1], r[0], r[1])); }
    m = Math.min(m, dedans ? -d : d);
  }
  return m;
};
const distRoute = (x, z) => { let m = 1e9; for (const r of routes) for (let i = 0; i + 3 < r.p.length; i += 2) m = Math.min(m, distSeg(x, z, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3])); return m; };
/** Point d'arrivée à pied près d'un bâtiment : hors de tout bâtiment (à 1,5 m au moins), de préférence sur une route ou un chemin. */
function arrivee(c, r0) {
  let best = null;
  for (let r = r0; r <= r0 + 40; r += 2) for (let a = 0; a < 360; a += 15) {
    const x = c[0] + Math.cos((a * Math.PI) / 180) * r, z = c[1] + Math.sin((a * Math.PI) / 180) * r;
    if (distBat(x, z) < 1.8) continue;
    const dr = distRoute(x, z);
    const score = r + Math.min(dr, 12) * 2 + (a > 180 ? 0 : 4); // préfère le côté sud-ouest/sud (z positif = sud)
    if (!best || score < best.score) best = { score, x, z };
  }
  return best ?? { x: c[0] + r0 + 4, z: c[1] };
}
const ajouterBat = (idl, nom, court, icone, b, rayonAction = 16) => {
  const [x, z] = b.c;
  const ar = arrivee(b.c, rayonBat(b));
  lieux.push({ id: idl, nom, court, icone, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, ax: Math.round(ar.x * 10) / 10, az: Math.round(ar.z * 10) / 10, rayon: rayonBat(b) + rayonAction, collision: 0, batiment: b.i });
};

// 1. église abbatiale : bâtiment le plus proche de l'origine (le centre est l'église)
const eglise = batimentProche([0, 0], (b) => b.aire > 150, 80);
ajouterBat('eglise', 'Église abbatiale Saint-Sindulphe', 'Abbatiale', '⛪', eglise, 14);
batiments[eglise.i].n = 'Église abbatiale';
// 2. autres bâtiments du village (cibles réglables dans cartes/<id>.json)
const cibles = cfg.cibles ?? {};
const prendre = (cle, filtre, repli) => {
  const cible = cibles[cle];
  const libres = (f) => (b) => b.i !== eglise.i && !lieux.some((l) => l.batiment === b.i) && f(b);
  return batimentProche(cible, libres(filtre), 250) ?? batimentProche(cible, libres(repli), 400);
};
const maison = prendre('maison', (b) => b.b.u === 'r' && b.aire > 60 && b.aire < 250, (b) => b.aire > 40);
if (maison) ajouterBat('maison', 'Maison familiale', 'Maison', '🏠', maison);
const pressoir = prendre('pressoir', (b) => (b.b.u === 'a' || b.b.u === 'i') && b.aire > 120, (b) => b.aire > 100);
if (pressoir) ajouterBat('pressoir', 'Pressoir', 'Pressoir', '⚙️', pressoir);
const cave = prendre('cave', (b) => (b.b.u === 'a' || b.b.u === 'i') && b.aire > 120, (b) => b.aire > 100);
if (cave) ajouterBat('cave', 'Cave et cuverie', 'Cave', '🍾', cave);
const notaire = prendre('notaire', (b) => b.b.u === 'c' || (b.b.u === 'r' && b.aire > 100), (b) => b.aire > 80);
if (notaire) ajouterBat('notaire', 'Notaire et banque', 'Notaire', '📜', notaire);

// 3. parcelles du joueur : rectangle d'aire donnée posé dans la vigne réelle la plus proche du village, rangs le long des courbes de niveau.
//    Les noms sont ceux des vrais lieux-dits de la commune (attribution par proximité) ; les emplacements sont approximatifs.
const parcelles = [];
const orient = (x, z) => { // direction des rangs = courbe de niveau (perpendiculaire à la pente), quantifiée sur 32 niveaux
  const gx = hAt(x + 6, z) - hAt(x - 6, z), gz = hAt(x, z + 6) - hAt(x, z - 6);
  let a = Math.atan2(gx, -gz);
  a = ((a % Math.PI) + Math.PI) % Math.PI;
  return Math.round((a / Math.PI) * 32) % 32;
};
const cibleP = cibles.cibleParcelles ?? [0, 0];
for (const pc of cfg.parcelles) {
  const surf = pc.ha * 10000, lon = Math.sqrt(surf * 1.5), lar = surf / lon;
  let meilleur = null;
  for (let X = bornes.minX + 40; X <= bornes.maxX - 40; X += 10) for (let Z = bornes.minZ + 40; Z <= bornes.maxZ - 60; Z += 10) {
    const d = dist([X, Z], cibleP);
    if (meilleur && d >= meilleur.d) continue;
    if (parcelles.some((p) => dist(p.c, [X, Z]) < 80)) continue;
    const k = orient(X, Z); const th = (k / 32) * Math.PI;
    const u = [Math.cos(th), Math.sin(th)], v = [-Math.sin(th), Math.cos(th)];
    const coins = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [X + (u[0] * a * lon) / 2 + v[0] * b * lar / 2, Z + (u[1] * a * lon) / 2 + v[1] * b * lar / 2]);
    const milieux = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].map(([a, b]) => [X + u[0] * a * lon + v[0] * b * lar, Z + u[1] * a * lon + v[1] * b * lar]);
    const poly = vignes.find((p) => coins.every((q) => dansPoly(q[0], q[1], p.pts)) && milieux.every((q) => dansPoly(q[0], q[1], p.pts)));
    if (!poly) continue;
    if (bats.some((b) => dist(b.c, [X, Z]) < lon && dansPoly(b.c[0], b.c[1], coins))) continue;
    if (routes.some((r) => r.w >= 4.5 && r.p.some((_, i) => i % 2 === 0 && dansPoly(r.p[i], r.p[i + 1], coins)))) continue;
    meilleur = { d, c: [X, Z], coins, k };
  }
  if (!meilleur) { console.warn(`  aucune vigne assez grande pour ${pc.id}`); continue; }
  parcelles.push({ id: pc.id, cepage: pc.cepage, ha: pc.ha, role: pc.role, c: meilleur.c, k: meilleur.k, coins: meilleur.coins.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]) });
}
const noms = [...cfg.nomsParcelles];
for (const p of parcelles) { // chaque parcelle prend le lieu-dit réel le plus proche encore libre
  const ld = lieuxDits.filter((l) => noms.includes(l.nom)).sort((a, b) => dist(a.xz, p.c) - dist(b.xz, p.c))[0];
  p.lieuDit = ld ? ld.nom : cfg.nom; if (ld) noms.splice(noms.indexOf(ld.nom), 1);
  const cap = p.lieuDit.charAt(0).toUpperCase() + p.lieuDit.slice(1);
  p.nom = cap;
  lieux.push({ id: p.id, nom: cap, court: cap.replace(/^(Les|Le|La|L') ?/i, ''), icone: '🍇', x: Math.round(p.c[0] * 10) / 10, z: Math.round(p.c[1] * 10) / 10, ax: Math.round(p.c[0] * 10) / 10, az: Math.round(p.c[1] * 10) / 10, rayon: Math.max(Math.sqrt(p.ha * 15000), 30) * 0.8, collision: 0, parcelle: true });
}
// 4. emplacements libres : château de la maison de négoce (fictif) et loge de vigne
const libre = (centre, rayon, pas2, ray, penteMax) => {
  let best = null;
  for (let a = -rayon; a <= rayon; a += pas2) for (let b = -rayon; b <= rayon; b += pas2) {
    const x = centre[0] + a, z = centre[1] + b;
    if (!ouvert(x, z, ray) || pente(x, z) > penteMax) continue;
    const dr = Math.min(...routes.map((r) => Math.min(...r.p.filter((_, i) => i % 2 === 0).map((px, i) => Math.hypot(px - x, r.p[i * 2 + 1] - z)))));
    const d = Math.hypot(a, b) + dr * 0.8;
    if (!best || d < best.d) best = { d, x, z };
  }
  return best;
};
const ch = libre(cibles.chateau ?? [330, 60], 220, 12, 38, 0.25);
if (ch) lieux.push({ id: 'chateau', nom: 'Maison Delaunay & Fils', court: 'Château', icone: '🏰', x: ch.x, z: ch.z, ax: ch.x, az: ch.z + 30, rayon: 46, collision: 22, fictif: true });
const pr0 = parcelles[0];
const lg = pr0 ? libre([pr0.c[0] + 10, pr0.c[1] - 70], 120, 6, 4, 0.5) ?? { x: pr0.c[0] + 60, z: pr0.c[1] } : null;
if (lg) lieux.push({ id: 'loge', nom: 'Loge de vigne', court: 'Loge', icone: '🛖', x: lg.x, z: lg.z, ax: lg.x, az: lg.z + 5, rayon: 12, collision: 2.6, fictif: true });

const sortie = {
  id, nom: cfg.nom, sousTitre: cfg.sousTitre, source: 'IGN BD TOPO®, RGE ALTI® — Licence Ouverte Etalab 2.0',
  centre: cfg.centre, bornes, pas, nx, nz, altitudeMin: Z0,
  relief: Buffer.from(hauteurs.buffer).toString('base64'),
  batiments, routes, vegetation, eau, cours, pois: pois.map((l) => ({ nom: l.nom, nat: l.nat, x: Math.round(l.xz[0]), z: Math.round(l.xz[1]) })), lieuxDits: lieuxDits.map((l) => ({ nom: l.nom, x: Math.round(l.xz[0]), z: Math.round(l.xz[1]) })),
  lieux, parcelles,
  rangs: { espacement: 1.1, niveauxAngle: 32 },
};
mkdirSync('src/data/cartes', { recursive: true });
writeFileSync(`src/data/cartes/${id}.json`, JSON.stringify(sortie));
const kb = Math.round(JSON.stringify(sortie).length / 1024);
console.log(`OK : ${batiments.length} bâtiments, ${routes.length} tronçons, ${vegetation.length} zones de végétation (${vignes.length} vignes), ${eau.length} plans d'eau, ${cours.length} cours d'eau, ${lieux.length} lieux, ${parcelles.length} parcelles → ${kb} Ko`);
console.log('Lieux :', lieux.map((l) => `${l.id}(${Math.round(l.x)},${Math.round(l.z)})`).join(' '));
