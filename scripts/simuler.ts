// Simulateur d'équilibrage : npm run simuler -- [parties] [annees]
import { simuler } from '../src/sim/simulateur';
import { copierParams } from '../src/sim/params';
import type { Synthese } from '../src/sim/simulateur';

const parties = Number(process.argv[2] ?? 500);
const annees = Number(process.argv[3] ?? 10);
const t0 = Date.now();
const res = simuler(parties, copierParams(), annees);
const f = (x: number, n = 0): string => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: n }) : '–');
console.log(`${parties} parties × ${annees} ans × 4 profils en ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
for (const s of res) afficher(s);
function afficher(s: Synthese): void {
  console.log(`== ${s.profil.toUpperCase()} — faillites : ${f(s.tauxFaillite * 100)} % ; trésorerie minimale moyenne ${f(s.minTresorerieMoy)} € (10 % pires : ${f(s.minTresorerieP10)} €) ; 1re vente de ses bouteilles : mois ${f(s.premiereVente, 1)} ; ~${f(s.minutesParAn)} min/an`);
  console.log('   an        ' + s.tresorerieAn.map((_, i) => String(i + 1).padStart(8)).join(''));
  console.log('   faillite% ' + s.faillitesAn.map((x) => f(x * 100).padStart(8)).join(''));
  console.log('   résultat  ' + s.resultatAn.map((x) => f(x).padStart(8)).join(''));
  console.log('   trésorerie' + s.tresorerieAn.map((x) => f(x).padStart(8)).join(''));
  console.log('   patrimoine' + s.patrimoineAn.map((x) => f(x).padStart(8)).join(''));
  console.log('   réputation' + s.reputationAn.map((x) => f(x, 1).padStart(8)).join(''));
}
