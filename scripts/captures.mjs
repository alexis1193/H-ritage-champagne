// Captures d'écran automatiques : 4 tailles de téléphone/tablette/ordinateur, paysage et portrait.
// Usage : npm run build && npm run captures   (le serveur de prévisualisation est lancé tout seul)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const TAILLES = [[360, 800], [390, 844], [768, 1024], [1280, 720]];
const sortie = process.argv[2] ?? 'captures';
mkdirSync(sortie, { recursive: true });

const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const rapport = [];

try {
  for (const [a, b] of TAILLES) {
    for (const [w, h, nom] of [[Math.min(a, b), Math.max(a, b), 'portrait'], [Math.max(a, b), Math.min(a, b), 'paysage']]) {
      const ctx = await navigateur.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
      await page.goto('http://localhost:4173/?debug', { waitUntil: 'load' });
      await page.waitForFunction(() => window.__jeu, null, { timeout: 20000 });
      await page.waitForTimeout(800);
      const p = (s) => `${sortie}/${w}x${h}-${nom}-${s}.png`;
      await page.screenshot({ path: p('1-depart') });

      // joystick : appui dans le quart bas gauche puis glissement vers le haut
      await page.mouse.move(w * 0.2, h * 0.8);
      await page.mouse.down();
      await page.mouse.move(w * 0.2, h * 0.8 - 40, { steps: 4 });
      await page.screenshot({ path: p('2-joystick') });
      await page.waitForTimeout(500);
      await page.mouse.up();

      for (const lieu of ['eglise', 'chateau', 'crayeres']) {
        await page.evaluate((id) => window.__jeu.allerA(id), lieu);
        await page.waitForTimeout(500);
        await page.screenshot({ path: p(`3-${lieu}`) });
      }
      await page.evaluate(() => window.__jeu.menu());
      await page.waitForTimeout(250);
      await page.screenshot({ path: p('4-menu') });
      await page.evaluate(() => window.__jeu.carte());
      await page.waitForTimeout(250);
      await page.screenshot({ path: p('5-carte') });
      await page.evaluate(() => window.__jeu.fermer());

      // mesures de mise en page : surface du monde visible, tailles minimales
      const m = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const barre = r('barre');
        const petits = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && (x.getBoundingClientRect().width < 44 || x.getBoundingClientRect().height < 40)).length;
        return { barreH: Math.round(barre.height), petits, fps: window.__jeu.etat().fps };
      });
      rapport.push({ taille: `${w}x${h} ${nom}`, ...m, erreurs: erreurs.length ? erreurs.slice(0, 2) : 'aucune' });
      await ctx.close();
    }
  }
} finally {
  await navigateur.close();
  srv.kill();
}
console.table(rapport);
