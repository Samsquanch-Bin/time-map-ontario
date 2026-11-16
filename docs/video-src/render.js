const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const fps = +(process.argv[2] || 24), only = process.argv[3];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1.5 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + __dirname + '/walkthrough.html');
  const total = await p.evaluate(() => window.TOTAL);
  fs.mkdirSync(__dirname + '/frames', { recursive: true });
  if (only) { // stills for checking
    for (const t of only.split(',').map(Number)) { await p.evaluate(t => render(t), t); await p.screenshot({ path: `${__dirname}/still-${t}.png` }); }
  } else {
    const n = Math.round(total * fps);
    for (let i = 0; i < n; i++) { await p.evaluate(t => render(t), i / fps); await p.screenshot({ path: `${__dirname}/frames/f${String(i).padStart(5, '0')}.png` }); }
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
